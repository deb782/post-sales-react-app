"""
Iteration-4 regression: auth bootstrap & gate.

Runs IN-PROCESS via FastAPI TestClient so we can monkeypatch
`server.requests.get` to simulate Emergent OAuth session-data responses
without a real Google login.

Pre-condition (verified by fixture): db.users is EMPTY. This IS the fix under test.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from pathlib import Path

import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from pymongo import MongoClient

# Make backend importable
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

import server  # noqa: E402
from server import app  # noqa: E402


# ---------------------------------------------------------------- fixtures --
@pytest.fixture(scope="module")
def sync_db():
    c = MongoClient(os.environ["MONGO_URL"])
    return c[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as tc:
        yield tc


def _mock_response(email: str, name: str, token: str, picture=None):
    """Build a fake requests.Response-like object."""
    payload = {"email": email, "name": name,
               "session_token": token, "picture": picture}
    return SimpleNamespace(
        status_code=200,
        json=lambda: payload,
        text=str(payload),
        raise_for_status=lambda: None,
    )


def _install_mock(monkeypatch, response_obj):
    def fake_get(url, headers=None, timeout=None):  # noqa: ARG001
        return response_obj
    monkeypatch.setattr(server.requests, "get", fake_get)


# ------------------------------------------------------------------ tests ---
class TestAuthBootstrap:
    """Ordered regression across the auth bootstrap gate."""

    def test_00_precondition_users_empty(self, sync_db):
        assert sync_db.users.count_documents({}) == 0, \
            "Fix under test requires users collection to be empty at start"
        assert sync_db.user_sessions.count_documents({}) == 0

    def test_01_bootstrap_creates_admin_and_sets_cookie(
            self, client, sync_db, monkeypatch):
        _install_mock(monkeypatch, _mock_response(
            "newadmin@example.com", "New Admin", "TOK_A", picture=None))
        r = client.post("/api/auth/session", json={"session_id": "sid_A"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["session_token"] == "TOK_A"
        u = body["user"]
        assert u["email"] == "newadmin@example.com"
        assert u["role"] == "admin"
        assert u["is_active"] is True

        # DB user row
        db_user = sync_db.users.find_one({"email": "newadmin@example.com"})
        assert db_user is not None
        assert db_user["role"] == "admin"

        # DB session row
        sess = sync_db.user_sessions.find_one({"session_token": "TOK_A"})
        assert sess is not None and sess["user_id"] == db_user["user_id"]

        # Cookie header assertions
        set_cookie = r.headers.get("set-cookie", "")
        assert "session_token=TOK_A" in set_cookie
        assert "HttpOnly" in set_cookie
        assert "Secure" in set_cookie
        assert "samesite=none" in set_cookie.lower()
        assert "Path=/" in set_cookie or "path=/" in set_cookie.lower()

    def test_02_me_with_bearer_returns_admin(self, client):
        r = client.get("/api/auth/me",
                       headers={"Authorization": "Bearer TOK_A"})
        assert r.status_code == 200, r.text
        me = r.json()
        assert me["email"] == "newadmin@example.com"
        assert me["role"] == "admin"
        assert me["is_active"] is True

    def test_03_stranger_email_rejected(self, client, monkeypatch):
        _install_mock(monkeypatch, _mock_response(
            "stranger@example.com", "Stranger", "TOK_STRANGER"))
        r = client.post("/api/auth/session", json={"session_id": "sid_S"})
        assert r.status_code == 403
        detail = (r.json().get("detail") or "").lower()
        assert "not authorized" in detail, r.text

    def test_04_admin_creates_invitee_then_invitee_can_login(
            self, client, monkeypatch, sync_db):
        # Admin creates invitee
        r = client.post(
            "/api/users",
            headers={"Authorization": "Bearer TOK_A"},
            json={"email": "invitee@example.com", "name": "Invitee",
                  "role": "accounts", "project_ids": []},
        )
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "accounts"

        # Now invitee logs in via emergent
        _install_mock(monkeypatch, _mock_response(
            "invitee@example.com", "Invitee", "TOK_INV"))
        r2 = client.post("/api/auth/session", json={"session_id": "sid_I"})
        assert r2.status_code == 200, r2.text
        u = r2.json()["user"]
        assert u["role"] == "accounts"
        assert u["email"] == "invitee@example.com"

        # /auth/me works with new token
        r3 = client.get("/api/auth/me",
                        headers={"Authorization": "Bearer TOK_INV"})
        assert r3.status_code == 200
        assert r3.json()["role"] == "accounts"

    def test_05_deactivated_user_cannot_login(
            self, client, monkeypatch, sync_db):
        invitee = sync_db.users.find_one({"email": "invitee@example.com"})
        r = client.patch(
            f"/api/users/{invitee['user_id']}",
            headers={"Authorization": "Bearer TOK_A"},
            json={"is_active": False},
        )
        assert r.status_code == 200
        assert r.json()["is_active"] is False

        _install_mock(monkeypatch, _mock_response(
            "invitee@example.com", "Invitee", "TOK_INV2"))
        r2 = client.post("/api/auth/session", json={"session_id": "sid_I2"})
        assert r2.status_code == 403
        detail = (r2.json().get("detail") or "").lower()
        assert "deactivated" in detail, r2.text

    def test_06_relogin_refreshes_name(
            self, client, monkeypatch, sync_db):
        _install_mock(monkeypatch, _mock_response(
            "newadmin@example.com", "Renamed", "TOK_A"))
        r = client.post("/api/auth/session", json={"session_id": "sid_A2"})
        assert r.status_code == 200
        assert r.json()["user"]["name"] == "Renamed"
        db_user = sync_db.users.find_one({"email": "newadmin@example.com"})
        assert db_user["name"] == "Renamed"

    def test_07_expired_session_401(self, client, sync_db):
        # Force TOK_A expiry into the past
        past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        sync_db.user_sessions.update_one(
            {"session_token": "TOK_A"},
            {"$set": {"expires_at": past}},
        )
        r = client.get("/api/auth/me",
                       headers={"Authorization": "Bearer TOK_A"})
        assert r.status_code == 401, r.text
        assert "expired" in (r.json().get("detail") or "").lower()

        # Restore for later tests
        future = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        sync_db.user_sessions.update_one(
            {"session_token": "TOK_A"},
            {"$set": {"expires_at": future}},
        )

    def test_08_demo_data_intact_projects_and_units(self, client):
        # Use admin token to fetch demo data
        r = client.get("/api/projects",
                       headers={"Authorization": "Bearer TOK_A"})
        assert r.status_code == 200, r.text
        projects = r.json()
        assert len(projects) >= 4, f"expected >=4 demo projects, got {len(projects)}"

        r2 = client.get("/api/units",
                        headers={"Authorization": "Bearer TOK_A"})
        assert r2.status_code == 200, r2.text
        units = r2.json()
        assert len(units) >= 100, f"expected >=100 demo units, got {len(units)}"


# ---------------------------------------------------------------- cleanup ---
@pytest.fixture(scope="module", autouse=True)
def _cleanup_after(sync_db):
    """After all tests: remove the users/sessions we created so re-runs work."""
    yield
    sync_db.users.delete_many({"email": {
        "$in": ["newadmin@example.com", "invitee@example.com",
                "stranger@example.com"]}})
    sync_db.user_sessions.delete_many({"session_token": {
        "$in": ["TOK_A", "TOK_INV", "TOK_INV2", "TOK_STRANGER"]}})
