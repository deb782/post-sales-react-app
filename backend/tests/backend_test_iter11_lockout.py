"""
Iter11 — targeted regression tests for the login lockout bug fix.

Focus:
 1. 5 wrong pw -> 401, 6th -> 429 with body containing 'Too many failed attempts'
    and a specific minute count like 'N minute(s)' (NOT generic 'a few minutes').
 2. During lockout, even CORRECT password returns 429.
 3. Forgot-password (a) always returns {ok:True,message:...}, (b) clears the
    lockout (login_attempts entry gone), (c) rotates the password (previous
    correct pw no longer works).
 4. Cooldown-expiry code review is asserted programmatically by manipulating
    login_attempts.locked_until into the past and confirming the next failed
    attempt starts fresh (count==1, no locked_until).
 5. Login end-to-end with seeded admin returns access_token + must_reset_password=True.
"""
import os
import re
import time
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # fallback to backend .env public URL
    BASE_URL = os.environ.get("APP_PUBLIC_URL", "").rstrip("/")

ADMIN_EMAIL = os.environ["ADMIN_EMAIL"].lower()
ADMIN_PW = os.environ["ADMIN_TEMP_PASSWORD"]

mongo = MongoClient(os.environ["MONGO_URL"])
db = mongo[os.environ["DB_NAME"]]


def _clear_lockout(email: str = ADMIN_EMAIL):
    db.login_attempts.delete_one({"_id": f"login:{email}"})


def _login(email: str, pw: str):
    return requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": pw},
        timeout=15,
    )


@pytest.fixture(autouse=True)
def _reset_lockout():
    _clear_lockout()
    yield
    _clear_lockout()


# ------------- (0) sanity: baseline first-wrong-pw is 401 not 429 ----
def test_first_wrong_password_is_401_not_429():
    r = _login(ADMIN_EMAIL, "definitely-wrong-xyz-1")
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"


# ------------- (1) 5 fails -> 401; 6th -> 429 with 'N minute(s)' ----
def test_lockout_triggers_and_message_has_specific_minutes():
    # attempts 1..5 should each be 401
    for i in range(1, 6):
        r = _login(ADMIN_EMAIL, f"wrong-pw-{i}")
        assert r.status_code == 401, (
            f"attempt {i} expected 401 got {r.status_code}: {r.text}"
        )

    # 6th attempt: locked. The fix sets locked_until on the 5th failure and
    # any subsequent login attempt (correct or wrong) returns 429.
    r6 = _login(ADMIN_EMAIL, "wrong-pw-6")
    assert r6.status_code == 429, f"expected 429 on 6th, got {r6.status_code}: {r6.text}"
    body = r6.json()
    detail = body.get("detail") or body.get("message") or str(body)
    assert "Too many failed attempts" in detail, f"missing header phrase: {detail!r}"
    # must NOT be the vague generic wording
    assert "a few minutes" not in detail.lower(), (
        f"error must include a specific minute count, not 'a few minutes': {detail!r}"
    )
    # must include a specific '<N> minute(s)' — e.g. '15 minutes', '14 minutes'
    m = re.search(r"\b(\d{1,3})\s+minute", detail)
    assert m, f"no 'N minute' phrase in: {detail!r}"
    mins = int(m.group(1))
    assert 1 <= mins <= 15, f"minute count out of expected range: {mins}"


# ------------- (2) during lockout, CORRECT password also 429 -------
def test_correct_password_still_locked_during_cooldown():
    # push into lockout
    for i in range(5):
        _login(ADMIN_EMAIL, f"junk-{i}")
    # now attempt with correct pw
    r = _login(ADMIN_EMAIL, ADMIN_PW)
    assert r.status_code == 429, (
        f"lockout must win over correct pw; got {r.status_code}: {r.text}"
    )
    detail = r.json().get("detail", "")
    assert "Too many failed attempts" in detail


# ------------- (3) forgot-password clears lockout + rotates pw ------
def test_forgot_password_clears_lockout_and_rotates_password():
    # lock the account
    for i in range(5):
        _login(ADMIN_EMAIL, f"junk-fp-{i}")
    assert db.login_attempts.find_one({"_id": f"login:{ADMIN_EMAIL}"}) is not None

    # capture current password hash for rotation check
    before = db.users.find_one({"email": ADMIN_EMAIL}, {"password_hash": 1})
    old_hash = before["password_hash"]

    r = requests.post(
        f"{BASE_URL}/api/auth/forgot-password",
        json={"email": ADMIN_EMAIL}, timeout=15,
    )
    assert r.status_code == 200, f"forgot-password status {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("ok") is True, f"missing ok:true; {body}"
    assert isinstance(body.get("message"), str) and body["message"], f"missing message; {body}"

    # (a) login_attempts entry cleared for login:<email>
    entry = db.login_attempts.find_one({"_id": f"login:{ADMIN_EMAIL}"})
    assert entry is None, f"login_attempts entry should be deleted, still present: {entry}"

    # (b) password rotated -> previous known pw no longer works, and returns 401 (not 429)
    after = db.users.find_one({"email": ADMIN_EMAIL}, {"password_hash": 1})
    assert after["password_hash"] != old_hash, "password_hash should have rotated"
    r2 = _login(ADMIN_EMAIL, ADMIN_PW)
    assert r2.status_code == 401, (
        f"login with pre-rotation pw must now 401, got {r2.status_code}: {r2.text}"
    )

    # -- Restore admin password for downstream tests / manual use --
    # Re-seed by directly writing bcrypt hash of ADMIN_TEMP_PASSWORD.
    import bcrypt
    new_hash = bcrypt.hashpw(ADMIN_PW.encode(), bcrypt.gensalt()).decode()
    db.users.update_one(
        {"email": ADMIN_EMAIL},
        {"$set": {"password_hash": new_hash, "must_reset_password": True}},
    )
    _clear_lockout()


# ------------- (4) cooldown-expiry: counter resets to 1 after window --
def test_cooldown_expiry_resets_counter():
    """
    Simulate the '15 minutes elapsed' branch by writing a locked_until in the
    past, then triggering another wrong login. Per the fix (server.py 762-764),
    the endpoint should delete the entry and treat it as fresh — the new failed
    attempt should insert count=1 with locked_until=None.
    """
    email = ADMIN_EMAIL
    past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    db.login_attempts.update_one(
        {"_id": f"login:{email}"},
        {"$set": {"count": 5, "last_at": past, "locked_until": past}},
        upsert=True,
    )
    # fire a wrong-pw attempt — cooldown has passed, so it should return 401
    r = _login(email, "any-wrong-pw-after-cooldown")
    assert r.status_code == 401, (
        f"after cooldown, wrong pw must be 401 (fresh), got {r.status_code}: {r.text}"
    )
    entry = db.login_attempts.find_one({"_id": f"login:{email}"})
    assert entry is not None, "entry should be re-created with count=1"
    assert entry.get("count") == 1, (
        f"counter must restart at 1 after cooldown expiry, got {entry.get('count')}"
    )
    assert entry.get("locked_until") in (None, ""), (
        f"locked_until must be None after fresh restart, got {entry.get('locked_until')}"
    )


# ------------- (5) end-to-end happy-path login ---------------------
def test_admin_login_success_returns_token_and_must_reset():
    _clear_lockout()
    r = _login(ADMIN_EMAIL, ADMIN_PW)
    assert r.status_code == 200, (
        f"admin login failed: {r.status_code}: {r.text}. "
        "If 401, pw may have been rotated by an earlier test run — "
        "re-seed via scripts/reset_and_seed.py."
    )
    body = r.json()
    assert isinstance(body.get("access_token"), str) and body["access_token"]
    assert body.get("must_reset_password") is True, (
        f"seeded admin should require reset on first login: {body}"
    )
    assert body["user"]["email"] == ADMIN_EMAIL
    assert "password_hash" not in body["user"]
