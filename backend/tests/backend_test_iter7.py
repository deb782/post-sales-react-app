"""Iteration 7 backend tests — SMTP (real Gmail), project image upload,
dashboard-config persistence + regressions."""
import io
import os
import uuid
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://property-ops-60.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@vistaestates.com"
ADMIN_TEMP = "Vista@Admin#2026"
ADMIN_NEW = "NewSecure#Test2026"


def _tiny_png() -> bytes:
    """Return a 1x1 red PNG (valid image bytes, ~67 bytes)."""
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = b"IHDR" + struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    ihdr_chunk = struct.pack(">I", 13) + ihdr + struct.pack(
        ">I", zlib.crc32(ihdr) & 0xFFFFFFFF)
    raw = b"\x00\xff\x00\x00"  # filter + RGB pixel
    comp = zlib.compress(raw)
    idat = b"IDAT" + comp
    idat_chunk = struct.pack(">I", len(comp)) + idat + struct.pack(
        ">I", zlib.crc32(idat) & 0xFFFFFFFF)
    iend = b"IEND"
    iend_chunk = struct.pack(">I", 0) + iend + struct.pack(
        ">I", zlib.crc32(iend) & 0xFFFFFFFF)
    return sig + ihdr_chunk + idat_chunk + iend_chunk


@pytest.fixture(scope="session")
def admin_token():
    """Login as admin. Tries rotated password first (idempotent across xdist
    workers), then falls back to temp password and rotates it."""
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_NEW})
    if r.status_code == 200:
        return r.json()["access_token"]
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_TEMP})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    tok = r.json()["access_token"]
    if r.json().get("must_reset_password"):
        requests.post(f"{API}/auth/change-password",
                      headers={"Authorization": f"Bearer {tok}"},
                      json={"current_password": ADMIN_TEMP,
                            "new_password": ADMIN_NEW})
        r3 = requests.post(f"{API}/auth/login",
                           json={"email": ADMIN_EMAIL,
                                 "password": ADMIN_NEW})
        return r3.json()["access_token"]
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def project_id(admin_headers):
    p = requests.post(f"{API}/projects", headers=admin_headers,
                      json={"name": f"TEST_Img_{uuid.uuid4().hex[:6]}",
                            "project_type": "residential",
                            "developer": "T", "city": "X"})
    assert p.status_code == 200, p.text
    return p.json()["project_id"]


# ============================================================ SMTP send ===
class TestSMTPInvite:
    def test_invite_returns_email_sent_flag_no_500(self, admin_headers):
        # Use plus-alias to avoid Gmail spam impact
        email = f"sales+iter7t{uuid.uuid4().hex[:4]}@agrocorp.co.in"
        r = requests.post(f"{API}/users", headers=admin_headers,
                          json={"email": email, "name": "SMTP Tester",
                                "role": "management", "project_ids": []})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "email_sent" in d, d
        assert isinstance(d["email_sent"], bool)
        assert "temp_password" in d
        print(f"[SMTP] email_sent = {d['email_sent']} for {email}")


# ============================================================ Project image ===
class TestProjectImageUpload:
    def test_upload_and_download(self, admin_headers, project_id):
        png = _tiny_png()
        files = {"file": ("test.png", png, "image/png")}
        r = requests.post(f"{API}/projects/{project_id}/image",
                          headers=admin_headers, files=files)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "file_id" in d and "image_url" in d
        assert d["image_url"].startswith("/api/files/")
        assert d["image_url"].endswith("/download")
        file_id = d["file_id"]

        # verify project doc has image_url
        projs = requests.get(f"{API}/projects", headers=admin_headers).json()
        p = next(x for x in projs if x["project_id"] == project_id)
        assert p.get("image_url") == d["image_url"], p

        # public download (no auth) works and returns image bytes
        dl = requests.get(f"{BASE_URL}{d['image_url']}")
        assert dl.status_code == 200, dl.text
        assert dl.headers.get("content-type", "").startswith("image/")
        assert dl.content == png

    def test_upload_nonexistent_project_404(self, admin_headers):
        png = _tiny_png()
        files = {"file": ("test.png", png, "image/png")}
        r = requests.post(f"{API}/projects/does-not-exist/image",
                          headers=admin_headers, files=files)
        assert r.status_code == 404, r.text

    def test_upload_requires_admin(self, admin_headers, project_id):
        # Create a management user, log in, and expect 403.
        email = f"sales+mgmt{uuid.uuid4().hex[:4]}@agrocorp.co.in"
        c = requests.post(f"{API}/users", headers=admin_headers,
                          json={"email": email, "name": "Mgmt",
                                "role": "management"}).json()
        temp = c["temp_password"]
        tok = requests.post(f"{API}/auth/login",
                            json={"email": email,
                                  "password": temp}).json()["access_token"]
        # change password to satisfy must_reset (optional here since role is enforced first)
        hdrs = {"Authorization": f"Bearer {tok}"}
        new_pw = "MgmtStrong#Pass2026"
        requests.post(f"{API}/auth/change-password", headers=hdrs,
                      json={"current_password": temp, "new_password": new_pw})
        tok2 = requests.post(f"{API}/auth/login",
                             json={"email": email,
                                   "password": new_pw}).json()["access_token"]
        hdrs2 = {"Authorization": f"Bearer {tok2}"}
        files = {"file": ("t.png", _tiny_png(), "image/png")}
        r = requests.post(f"{API}/projects/{project_id}/image",
                          headers=hdrs2, files=files)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"


# ============================================================ Dashboard config ===
class TestDashboardConfig:
    def _fresh_user_headers(self, admin_headers):
        email = f"sales+dc{uuid.uuid4().hex[:4]}@agrocorp.co.in"
        c = requests.post(f"{API}/users", headers=admin_headers,
                          json={"email": email, "name": "DC",
                                "role": "management"}).json()
        temp = c["temp_password"]
        tok = requests.post(f"{API}/auth/login",
                            json={"email": email,
                                  "password": temp}).json()["access_token"]
        hdrs = {"Authorization": f"Bearer {tok}"}
        new_pw = "DCStrong#Pass2026"
        requests.post(f"{API}/auth/change-password", headers=hdrs,
                      json={"current_password": temp, "new_password": new_pw})
        tok2 = requests.post(f"{API}/auth/login",
                             json={"email": email,
                                   "password": new_pw}).json()["access_token"]
        return {"Authorization": f"Bearer {tok2}"}

    def test_get_initial_empty(self, admin_headers):
        hdrs = self._fresh_user_headers(admin_headers)
        r = requests.get(f"{API}/me/dashboard-config", headers=hdrs)
        assert r.status_code == 200
        assert r.json() == {"widgets": []}

    def test_patch_persists_order(self, admin_headers):
        hdrs = self._fresh_user_headers(admin_headers)
        w = ["kpis", "variance", "vendors"]
        r = requests.patch(f"{API}/me/dashboard-config", headers=hdrs,
                           json={"widgets": w})
        assert r.status_code == 200
        r2 = requests.get(f"{API}/me/dashboard-config", headers=hdrs)
        assert r2.json()["widgets"] == w

    def test_patch_empty_persists(self, admin_headers):
        hdrs = self._fresh_user_headers(admin_headers)
        # first set some, then empty
        requests.patch(f"{API}/me/dashboard-config", headers=hdrs,
                       json={"widgets": ["kpis"]})
        r = requests.patch(f"{API}/me/dashboard-config", headers=hdrs,
                          json={"widgets": []})
        assert r.status_code == 200
        r2 = requests.get(f"{API}/me/dashboard-config", headers=hdrs)
        assert r2.json()["widgets"] == []


# ============================================================ Regressions ===
class TestRegression:
    def test_dashboard_summary(self, admin_headers):
        r = requests.get(f"{API}/dashboard/summary", headers=admin_headers)
        assert r.status_code == 200

    def test_users_list(self, admin_headers):
        r = requests.get(f"{API}/users", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_projects_list(self, admin_headers):
        r = requests.get(f"{API}/projects", headers=admin_headers)
        assert r.status_code == 200

    def test_revenue_targets(self, admin_headers, project_id):
        r = requests.post(f"{API}/revenue-targets", headers=admin_headers,
                          json={"project_id": project_id,
                                "period_type": "monthly",
                                "period_key": "2026-03", "amount": 250000})
        assert r.status_code == 200, r.text
