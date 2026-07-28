"""Iteration 2 backend tests: reserved workflow, bulk units, exports,
public settings, logo upload, top_vendors on dashboard/summary.

Kept in a separate module so we don't wipe iter-1 seed data — this
module seeds its own admin + site_manager sessions directly in Mongo.
"""
import os
import io
import uuid
import base64
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://property-ops-60.preview.emergentagent.com",
).rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

mongo = MongoClient(MONGO_URL)
db = mongo[DB_NAME]

# Tiny 1x1 red PNG
TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
)


def _mk_session(email: str, role: str, project_ids=None):
    uid = f"user_{uuid.uuid4().hex[:12]}"
    tok = f"tok_{uuid.uuid4().hex}"
    db.users.insert_one({
        "user_id": uid, "email": email.lower(), "name": email.split("@")[0],
        "picture": None, "role": role, "project_ids": project_ids or [],
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    db.user_sessions.insert_one({
        "session_token": tok, "user_id": uid,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return uid, tok


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin():
    uid, tok = _mk_session(f"TEST2_admin_{uuid.uuid4().hex[:6]}@example.com", "admin")
    return {"uid": uid, "token": tok, "hdr": _hdr(tok)}


@pytest.fixture(scope="module")
def accounts():
    uid, tok = _mk_session(f"TEST2_acc_{uuid.uuid4().hex[:6]}@example.com", "accounts")
    return {"uid": uid, "token": tok, "hdr": _hdr(tok)}


@pytest.fixture(scope="module")
def project(admin):
    r = requests.post(f"{BASE_URL}/api/projects", headers=admin["hdr"],
                      json={"name": f"TEST2_Proj_{uuid.uuid4().hex[:6]}",
                            "target_revenue": 1000000})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def site_manager(project):
    uid, tok = _mk_session(
        f"TEST2_sm_{uuid.uuid4().hex[:6]}@example.com", "site_manager",
        project_ids=[project["project_id"]])
    return {"uid": uid, "token": tok, "hdr": _hdr(tok)}


# -------------------------------------------------- public settings -------
class TestPublicSettings:
    def test_public_settings_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/settings/public")
        assert r.status_code == 200
        d = r.json()
        assert "company_name" in d
        assert "currency" in d
        assert "logo_file_id" in d


# -------------------------------------------------- bulk units ------------
class TestBulkUnits:
    def test_bulk_create_with_pad_and_skip(self, admin, project):
        pid = project["project_id"]
        # pre-existing single unit to test skip
        requests.post(f"{BASE_URL}/api/units", headers=admin["hdr"],
                      json={"project_id": pid, "unit_number": "B-005",
                            "price": 100})
        r = requests.post(f"{BASE_URL}/api/units/bulk", headers=admin["hdr"],
                          json={"project_id": pid, "prefix": "B-",
                                "start": 1, "end": 10, "pad": 3,
                                "base_price": 500000})
        assert r.status_code == 200, r.text
        d = r.json()
        # B-005 already exists and equals padded "B-" + "005" -> 1 skip
        assert d["created"] == 9
        assert "B-005" in d["skipped"]
        # Now create with pad=0 to hit an overlap at "B-5" only if we
        # re-run with pad=3 same range — expect skips.
        r2 = requests.post(f"{BASE_URL}/api/units/bulk", headers=admin["hdr"],
                           json={"project_id": pid, "prefix": "B-",
                                 "start": 1, "end": 3, "pad": 3,
                                 "base_price": 111})
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["created"] == 0
        assert len(d2["skipped"]) == 3

    def test_bulk_cap_500(self, admin, project):
        r = requests.post(f"{BASE_URL}/api/units/bulk", headers=admin["hdr"],
                          json={"project_id": project["project_id"],
                                "prefix": "Z-", "start": 1, "end": 1000,
                                "pad": 0, "base_price": 0})
        assert r.status_code == 400

    def test_bulk_requires_admin(self, site_manager, project):
        r = requests.post(f"{BASE_URL}/api/units/bulk",
                          headers=site_manager["hdr"],
                          json={"project_id": project["project_id"],
                                "prefix": "X-", "start": 1, "end": 2})
        assert r.status_code == 403


# ---------------------------------------------- reserve workflow ---------
class TestReserveWorkflow:
    def _make_unit(self, admin, project, num):
        r = requests.post(f"{BASE_URL}/api/units", headers=admin["hdr"],
                          json={"project_id": project["project_id"],
                                "unit_number": num, "price": 2000000})
        assert r.status_code == 200
        return r.json()

    def test_reserve_and_release_flow(self, admin, project):
        u = self._make_unit(admin, project, f"R-{uuid.uuid4().hex[:4]}")
        r = requests.post(f"{BASE_URL}/api/units/{u['unit_id']}/reserve",
                          headers=admin["hdr"],
                          json={"buyer_name": "Priya",
                                "buyer_contact": "9000000000",
                                "reserved_until": "2026-12-31"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "reserved"
        assert d["buyer_name"] == "Priya"
        assert d["reserved_until"] == "2026-12-31"
        assert d["reserved_at"] is not None

        # verify persistence via GET list
        lr = requests.get(f"{BASE_URL}/api/units",
                          params={"project_id": project["project_id"]},
                          headers=admin["hdr"])
        matched = next(x for x in lr.json() if x["unit_id"] == u["unit_id"])
        assert matched["status"] == "reserved"

        # release
        rr = requests.post(f"{BASE_URL}/api/units/{u['unit_id']}/release",
                           headers=admin["hdr"])
        assert rr.status_code == 200
        d2 = rr.json()
        assert d2["status"] == "available"
        assert d2["buyer_name"] is None
        assert d2["reserved_until"] is None

    def test_release_non_reserved_400(self, admin, project):
        u = self._make_unit(admin, project, f"R2-{uuid.uuid4().hex[:4]}")
        r = requests.post(f"{BASE_URL}/api/units/{u['unit_id']}/release",
                          headers=admin["hdr"])
        assert r.status_code == 400

    def test_sell_clears_reservation(self, admin, project):
        u = self._make_unit(admin, project, f"R3-{uuid.uuid4().hex[:4]}")
        # reserve first
        requests.post(f"{BASE_URL}/api/units/{u['unit_id']}/reserve",
                      headers=admin["hdr"],
                      json={"buyer_name": "TempBuyer",
                            "reserved_until": "2026-06-01"})
        # then sell to different buyer
        r = requests.post(f"{BASE_URL}/api/units/{u['unit_id']}/sell",
                          headers=admin["hdr"],
                          json={"buyer_name": "FinalBuyer",
                                "buyer_contact": "8888",
                                "total_price": 2100000})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "sold"
        assert d["buyer_name"] == "FinalBuyer"
        assert d["reserved_until"] is None
        assert d["reserved_at"] is None

    def test_reserve_sold_unit_400(self, admin, project):
        u = self._make_unit(admin, project, f"R4-{uuid.uuid4().hex[:4]}")
        requests.post(f"{BASE_URL}/api/units/{u['unit_id']}/sell",
                      headers=admin["hdr"],
                      json={"buyer_name": "X", "total_price": 100})
        r = requests.post(f"{BASE_URL}/api/units/{u['unit_id']}/reserve",
                          headers=admin["hdr"],
                          json={"buyer_name": "Late"})
        assert r.status_code == 400

    def test_reserve_requires_admin(self, site_manager, admin, project):
        u = requests.post(f"{BASE_URL}/api/units", headers=admin["hdr"],
                          json={"project_id": project["project_id"],
                                "unit_number": f"R5-{uuid.uuid4().hex[:4]}",
                                "price": 1}).json()
        r = requests.post(f"{BASE_URL}/api/units/{u['unit_id']}/reserve",
                          headers=site_manager["hdr"],
                          json={"buyer_name": "SM"})
        assert r.status_code == 403


# ------------------------------------------------- exports ---------------
XLSX_CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class TestExports:
    def test_export_units_xlsx(self, admin):
        r = requests.get(f"{BASE_URL}/api/exports/units", headers=admin["hdr"])
        assert r.status_code == 200
        assert XLSX_CT in r.headers.get("content-type", "")
        assert len(r.content) > 100

    def test_export_expenses_xlsx(self, admin):
        r = requests.get(f"{BASE_URL}/api/exports/expenses", headers=admin["hdr"])
        assert r.status_code == 200
        assert XLSX_CT in r.headers.get("content-type", "")

    def test_export_payments_xlsx(self, admin):
        r = requests.get(f"{BASE_URL}/api/exports/payments", headers=admin["hdr"])
        assert r.status_code == 200
        assert XLSX_CT in r.headers.get("content-type", "")

    def test_export_stock_xlsx(self, admin):
        r = requests.get(f"{BASE_URL}/api/exports/stock", headers=admin["hdr"])
        assert r.status_code == 200
        assert XLSX_CT in r.headers.get("content-type", "")


# ------------------------------------------------- logo upload -----------
class TestLogo:
    logo_file_id: str = ""

    def test_upload_logo_admin(self, admin):
        files = {"file": ("logo.png", TINY_PNG, "image/png")}
        r = requests.post(f"{BASE_URL}/api/files/logo",
                          headers={"Authorization": f"Bearer {admin['token']}"},
                          files=files)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("is_public") is True
        assert d["file_id"].startswith("file_")
        TestLogo.logo_file_id = d["file_id"]

    def test_settings_updated_with_logo(self, admin):
        r = requests.get(f"{BASE_URL}/api/settings", headers=admin["hdr"])
        assert r.status_code == 200
        assert r.json()["logo_file_id"] == TestLogo.logo_file_id

    def test_public_settings_returns_logo(self):
        r = requests.get(f"{BASE_URL}/api/settings/public")
        assert r.status_code == 200
        assert r.json()["logo_file_id"] == TestLogo.logo_file_id

    def test_logo_download_no_auth(self):
        # public logo -> no auth needed
        r = requests.get(f"{BASE_URL}/api/files/{TestLogo.logo_file_id}/download")
        assert r.status_code == 200
        assert r.content[:8] == b"\x89PNG\r\n\x1a\n" or len(r.content) > 0

    def test_logo_upload_forbidden_for_sitemgr(self, site_manager):
        files = {"file": ("l.png", TINY_PNG, "image/png")}
        r = requests.post(f"{BASE_URL}/api/files/logo",
                          headers={"Authorization": f"Bearer {site_manager['token']}"},
                          files=files)
        assert r.status_code == 403


# --------------------------------------------- dashboard top_vendors -----
class TestTopVendors:
    def test_top_vendors_present(self, admin, site_manager, accounts, project):
        pid = project["project_id"]
        # Create 2 approved expenses w/ different vendors this month
        for vendor, amt in [("VendorAlpha", 10000), ("VendorBeta", 20000)]:
            r = requests.post(f"{BASE_URL}/api/expenses",
                              headers=site_manager["hdr"],
                              json={"project_id": pid, "category": "materials",
                                    "amount": amt, "vendor": vendor})
            eid = r.json()["expense_id"]
            # small amount auto-finalises on stage1 approve
            r2 = requests.post(f"{BASE_URL}/api/expenses/{eid}/stage1",
                               headers=accounts["hdr"],
                               json={"action": "approve"})
            assert r2.json()["status"] == "final_approved"

        r = requests.get(f"{BASE_URL}/api/dashboard/summary",
                         headers=admin["hdr"])
        assert r.status_code == 200
        d = r.json()
        assert "top_vendors" in d
        vendors = d["top_vendors"]
        assert isinstance(vendors, list)
        assert len(vendors) <= 5
        names = [v["vendor"] for v in vendors]
        assert "VendorAlpha" in names or "VendorBeta" in names
        for v in vendors:
            assert set(v.keys()) >= {"vendor", "this_month", "last_month", "delta_pct"}
            # last_month=0 => delta_pct null
            if v["last_month"] == 0:
                assert v["delta_pct"] is None
