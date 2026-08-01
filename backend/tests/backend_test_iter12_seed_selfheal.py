"""
Iter12 — Backend regression for:
  (1) Code-level ADMIN_* defaults in server.py match user's chosen admin.
  (2) Startup self-heal reactivates a deactivated admin and clears stale lockouts.
  (3) Seed idempotency: existing admin's password is NOT overwritten on restart.
  (4) delete_one is safe when login_attempts entry does not exist.
  (5) End-to-end login with seeded admin returns access_token + must_reset_password.
"""
import os
import re
import subprocess
import time
from pathlib import Path

import bcrypt
import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get(
    "REACT_APP_BACKEND_URL") else os.environ.get("APP_PUBLIC_URL", "").rstrip("/")
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"].lower()
ADMIN_PW = os.environ["ADMIN_TEMP_PASSWORD"]

mongo = MongoClient(os.environ["MONGO_URL"])
db = mongo[os.environ["DB_NAME"]]


def _clear_lockout(email: str = ADMIN_EMAIL):
    db.login_attempts.delete_one({"_id": f"login:{email}"})


def _login(email: str, pw: str):
    return requests.post(f"{BASE_URL}/api/auth/login",
                         json={"email": email, "password": pw}, timeout=15)


def _restart_backend_and_wait():
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"],
                   check=True, capture_output=True)
    # poll /api/ for readiness
    for _ in range(30):
        try:
            r = requests.get(f"{BASE_URL}/api/", timeout=5)
            if r.status_code < 500:
                return
        except Exception:
            pass
        time.sleep(1)
    pytest.fail("backend did not come back online after restart")


# ---------- (1) Code review: defaults in source ----------
def test_source_defaults_match_user_admin():
    src = Path("/app/backend/server.py").read_text()
    # env-driven with correct default
    assert re.search(
        r'ADMIN_EMAIL\s*=\s*os\.environ\.get\(\s*"ADMIN_EMAIL"\s*,\s*"deb@agrocorp\.co\.in"\s*\)\.lower\(\)',
        src), "ADMIN_EMAIL default must be deb@agrocorp.co.in via os.environ.get"
    assert re.search(
        r'ADMIN_TEMP_PASSWORD\s*=\s*os\.environ\.get\(\s*"ADMIN_TEMP_PASSWORD"\s*,\s*"Admin@Agro@2026#"\s*\)',
        src), "ADMIN_TEMP_PASSWORD default must be Admin@Agro@2026# via os.environ.get"
    assert re.search(
        r'ADMIN_NAME\s*=\s*os\.environ\.get\(\s*"ADMIN_NAME"\s*,\s*"Agrocorp Admin"\s*\)',
        src), "ADMIN_NAME default must be 'Agrocorp Admin' via os.environ.get"
    # no leftover Vista references in defaults
    assert "vistaestates.com" not in src.lower(), "stale vista default still present"
    assert "Vista@Admin" not in src, "stale Vista@Admin default still present"


# ---------- (2) Startup reactivates deactivated admin + clears lockout ----------
def test_startup_reactivates_and_clears_lockout():
    # deactivate admin + insert a fake lockout entry
    db.users.update_one({"email": ADMIN_EMAIL},
                        {"$set": {"is_active": False}})
    db.login_attempts.update_one(
        {"_id": f"login:{ADMIN_EMAIL}"},
        {"$set": {"count": 99, "last_at": "2026-01-01T00:00:00+00:00",
                  "locked_until": "2099-01-01T00:00:00+00:00"}},
        upsert=True,
    )
    # sanity: locked
    assert db.users.find_one({"email": ADMIN_EMAIL})["is_active"] is False
    assert db.login_attempts.find_one({"_id": f"login:{ADMIN_EMAIL}"}) is not None

    _restart_backend_and_wait()

    # verify self-heal
    user = db.users.find_one({"email": ADMIN_EMAIL})
    assert user["is_active"] is True, "startup must reactivate the seeded admin"
    entry = db.login_attempts.find_one({"_id": f"login:{ADMIN_EMAIL}"})
    assert entry is None, f"startup must clear stale lockout, still present: {entry}"

    # login now works
    r = _login(ADMIN_EMAIL, ADMIN_PW)
    assert r.status_code == 200, f"login should work after self-heal: {r.status_code} {r.text}"


# ---------- (3) Seed idempotency: existing password not overwritten ----------
def test_seed_does_not_overwrite_existing_password():
    # rotate admin password to a custom one (simulating user having changed it)
    custom_pw = "UserChanged#Pw2026!"
    custom_hash = bcrypt.hashpw(custom_pw.encode(), bcrypt.gensalt()).decode()
    db.users.update_one({"email": ADMIN_EMAIL},
                        {"$set": {"password_hash": custom_hash,
                                  "must_reset_password": False,
                                  "is_active": True}})
    _clear_lockout()

    _restart_backend_and_wait()

    # After restart, custom password should STILL work; seed default should NOT
    r_custom = _login(ADMIN_EMAIL, custom_pw)
    assert r_custom.status_code == 200, (
        f"user's changed password must survive restart, got {r_custom.status_code}: {r_custom.text}"
    )

    # Restore admin to the seeded temp password for downstream tests
    seed_hash = bcrypt.hashpw(ADMIN_PW.encode(), bcrypt.gensalt()).decode()
    db.users.update_one({"email": ADMIN_EMAIL},
                        {"$set": {"password_hash": seed_hash,
                                  "must_reset_password": True,
                                  "is_active": True}})
    _clear_lockout()


# ---------- (4) delete_one on missing login_attempts is safe ----------
def test_startup_safe_when_no_lockout_entry():
    _clear_lockout()
    assert db.login_attempts.find_one({"_id": f"login:{ADMIN_EMAIL}"}) is None

    _restart_backend_and_wait()

    # backend up & healthy after restart with no lockout doc
    r = requests.get(f"{BASE_URL}/api/", timeout=10)
    assert r.status_code < 500, f"backend unhealthy after clean startup: {r.status_code}"


# ---------- (5) End-to-end happy path login ----------
def test_admin_login_returns_token_and_must_reset():
    _clear_lockout()
    r = _login(ADMIN_EMAIL, ADMIN_PW)
    assert r.status_code == 200, f"admin login failed: {r.status_code}: {r.text}"
    body = r.json()
    assert isinstance(body.get("access_token"), str) and body["access_token"]
    assert body.get("must_reset_password") is True
    assert body["user"]["email"] == ADMIN_EMAIL
    assert "password_hash" not in body["user"]
