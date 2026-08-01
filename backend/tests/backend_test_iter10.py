"""
Iter10 backend regression: Users management (admin+management) + Profile self-service.
Covers:
- Admin login and /auth/me
- POST /users (admin, management), 403 mgmt->admin
- POST /users/{id}/reset-password
- PATCH /users/{id}
- DELETE /users/{id}  + POST /users/{id}/reactivate
- Self-deactivation blocked (400)
- Management guards: cannot edit / deactivate / reset admin (403), cannot promote to admin (403)
- PATCH /me/profile (allowed keys only)
- POST /auth/change-password (success + wrong current 400)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://property-ops-60.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sales@agrocorp.co.in"
ADMIN_PASSWORD = "Agrocorp@2026#"


def _login(session, email, password):
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    data = r.json()
    session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    return data


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    data = _login(s, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert data["user"]["role"] == "admin"
    return s, data["user"]


@pytest.fixture(scope="module")
def mgmt_user(admin):
    """Create a management user via admin invite for role-guard tests."""
    s_admin, _ = admin
    import uuid
    email = f"test_mgmt_{uuid.uuid4().hex[:6]}@agrocorp.co.in"
    r = s_admin.post(f"{API}/users", json={
        "email": email, "name": "TEST Mgmt", "role": "management", "phone": "+919000000000"
    })
    assert r.status_code == 200, r.text
    invite = r.json()
    temp_pw = invite["temp_password"]

    # Force-reset: login with temp, then change password
    s_mgmt = requests.Session()
    s_mgmt.headers.update({"Content-Type": "application/json"})
    _login(s_mgmt, email, temp_pw)
    new_pw = "MgmtIter10#Pass2026"
    r2 = s_mgmt.post(f"{API}/auth/change-password", json={
        "current_password": temp_pw, "new_password": new_pw
    })
    assert r2.status_code == 200, r2.text
    # re-login for fresh cookie
    _login(s_mgmt, email, new_pw)
    return s_mgmt, invite["user"], new_pw


@pytest.fixture(scope="module")
def sales_user(admin):
    s_admin, _ = admin
    import uuid
    email = f"test_sales_{uuid.uuid4().hex[:6]}@agrocorp.co.in"
    r = s_admin.post(f"{API}/users", json={
        "email": email, "name": "TEST Sales Person", "role": "sales"
    })
    assert r.status_code == 200
    return r.json()["user"]


# ---------- Admin flows ----------

class TestAdminUserFlows:
    def test_list_users(self, admin):
        s, _ = admin
        r = s.get(f"{API}/users")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert any(u["email"] == ADMIN_EMAIL for u in r.json())

    def test_create_invite_returns_temp_password(self, admin):
        s, _ = admin
        import uuid
        email = f"test_invite_{uuid.uuid4().hex[:6]}@agrocorp.co.in"
        r = s.post(f"{API}/users", json={
            "email": email, "name": "TEST Invite", "role": "site_manager", "project_ids": []
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["email"] == email
        assert d["user"]["role"] == "site_manager"
        assert isinstance(d["temp_password"], str) and len(d["temp_password"]) >= 8
        assert d["login_url"].endswith("/login")

    def test_reset_password(self, admin, sales_user):
        s, _ = admin
        r = s.post(f"{API}/users/{sales_user['user_id']}/reset-password")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "temp_password" in d and len(d["temp_password"]) >= 8

    def test_patch_user(self, admin, sales_user):
        s, _ = admin
        r = s.patch(f"{API}/users/{sales_user['user_id']}", json={
            "name": "TEST Sales Updated", "phone": "+919111111111"
        })
        assert r.status_code == 200, r.text
        assert r.json()["name"] == "TEST Sales Updated"
        assert r.json()["phone"] == "+919111111111"

        # GET to verify persistence
        r2 = s.get(f"{API}/users")
        u = next(x for x in r2.json() if x["user_id"] == sales_user["user_id"])
        assert u["name"] == "TEST Sales Updated"

    def test_deactivate_and_reactivate(self, admin, sales_user):
        s, _ = admin
        r = s.delete(f"{API}/users/{sales_user['user_id']}")
        assert r.status_code == 200
        r2 = s.get(f"{API}/users")
        u = next(x for x in r2.json() if x["user_id"] == sales_user["user_id"])
        assert u["is_active"] is False

        r3 = s.post(f"{API}/users/{sales_user['user_id']}/reactivate")
        assert r3.status_code == 200
        r4 = s.get(f"{API}/users")
        u = next(x for x in r4.json() if x["user_id"] == sales_user["user_id"])
        assert u["is_active"] is True

    def test_admin_cannot_self_deactivate(self, admin):
        s, me = admin
        r = s.delete(f"{API}/users/{me['user_id']}")
        assert r.status_code == 400


# ---------- Management guards ----------

class TestManagementGuards:
    def test_mgmt_can_list_users(self, mgmt_user):
        s, _, _ = mgmt_user
        r = s.get(f"{API}/users")
        assert r.status_code == 200

    def test_mgmt_can_invite_nonadmin(self, mgmt_user):
        s, _, _ = mgmt_user
        import uuid
        email = f"test_mgmt_invite_{uuid.uuid4().hex[:6]}@agrocorp.co.in"
        r = s.post(f"{API}/users", json={
            "email": email, "name": "TEST MgmtInvite", "role": "sales"
        })
        assert r.status_code == 200, r.text

    def test_mgmt_cannot_create_admin(self, mgmt_user):
        s, _, _ = mgmt_user
        import uuid
        email = f"test_mgmt_admin_{uuid.uuid4().hex[:6]}@agrocorp.co.in"
        r = s.post(f"{API}/users", json={
            "email": email, "name": "TEST NopeAdmin", "role": "admin"
        })
        assert r.status_code == 403

    def test_mgmt_cannot_edit_admin(self, mgmt_user, admin):
        s, _, _ = mgmt_user
        _, admin_me = admin
        r = s.patch(f"{API}/users/{admin_me['user_id']}", json={"name": "Hacked"})
        assert r.status_code == 403

    def test_mgmt_cannot_reset_admin(self, mgmt_user, admin):
        s, _, _ = mgmt_user
        _, admin_me = admin
        r = s.post(f"{API}/users/{admin_me['user_id']}/reset-password")
        assert r.status_code == 403

    def test_mgmt_cannot_deactivate_admin(self, mgmt_user, admin):
        s, _, _ = mgmt_user
        _, admin_me = admin
        r = s.delete(f"{API}/users/{admin_me['user_id']}")
        assert r.status_code == 403

    def test_mgmt_cannot_promote_to_admin(self, mgmt_user, sales_user):
        s, _, _ = mgmt_user
        r = s.patch(f"{API}/users/{sales_user['user_id']}", json={"role": "admin"})
        assert r.status_code == 403


# ---------- Profile self-service ----------

class TestProfile:
    def test_patch_me_profile_name_phone(self, mgmt_user):
        s, _, _ = mgmt_user
        r = s.patch(f"{API}/me/profile", json={"name": "TEST Mgmt Renamed", "phone": "+919222222222"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST Mgmt Renamed"
        assert d["phone"] == "+919222222222"

    def test_patch_me_profile_ignores_disallowed_keys(self, mgmt_user):
        s, _, _ = mgmt_user
        r = s.patch(f"{API}/me/profile", json={"role": "admin", "email": "x@y.z"})
        # No allowed keys present -> 400 "Nothing to update"
        assert r.status_code == 400

    def test_patch_me_profile_persists(self, mgmt_user):
        s, mgmt_info, _ = mgmt_user
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["name"] == "TEST Mgmt Renamed"
        # role must NOT have changed
        assert r.json()["role"] == "management"

    def test_change_password_wrong_current(self, mgmt_user):
        s, _, _ = mgmt_user
        r = s.post(f"{API}/auth/change-password", json={
            "current_password": "WrongPass!123", "new_password": "SomeNew@Pass2026"
        })
        assert r.status_code == 400

    def test_change_password_success(self, mgmt_user):
        s, _, current_pw = mgmt_user
        new_pw = "MgmtIter10#Round2"
        r = s.post(f"{API}/auth/change-password", json={
            "current_password": current_pw, "new_password": new_pw
        })
        assert r.status_code == 200
