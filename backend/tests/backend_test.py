"""Backend integration tests for Real Estate Stakeholder Dashboard.

Covers auth, RBAC, projects, unit types, units, sales, payments, revenue,
expenses (2-stage approval + rejection), notifications, stock, settings,
users, audit-logs, excel template/import, search, dashboard summary.
"""
import os
import io
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from openpyxl import Workbook

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://property-ops-60.preview.emergentagent.com",
).rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

mongo = MongoClient(MONGO_URL)
db = mongo[DB_NAME]


# ------------------------------------------------------------- helpers ----
def _mk_user_session(email: str, role: str, project_ids=None):
    uid = f"user_{uuid.uuid4().hex[:12]}"
    token = f"tok_{uuid.uuid4().hex}"
    db.users.insert_one({
        "user_id": uid, "email": email.lower(), "name": email.split("@")[0],
        "picture": None, "role": role, "project_ids": project_ids or [],
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    db.user_sessions.insert_one({
        "session_token": token, "user_id": uid,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return uid, token


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ------------------------------------------------- module-level fixtures --
@pytest.fixture(scope="module", autouse=True)
def clean_db():
    """Fresh DB state for module."""
    for c in ["users", "user_sessions", "projects", "unit_types", "units",
              "payments", "expenses", "stock_items", "stock_movements",
              "audit_logs", "notifications", "settings", "files"]:
        db[c].delete_many({})
    yield
    # Leave data for inspection; comment cleanup out


@pytest.fixture(scope="module")
def admin():
    uid, tok = _mk_user_session(f"TEST_admin_{uuid.uuid4().hex[:6]}@example.com", "admin")
    return {"uid": uid, "token": tok, "hdr": _hdr(tok)}


@pytest.fixture(scope="module")
def accounts():
    uid, tok = _mk_user_session(f"TEST_acc_{uuid.uuid4().hex[:6]}@example.com", "accounts")
    return {"uid": uid, "token": tok, "hdr": _hdr(tok)}


@pytest.fixture(scope="module")
def management():
    uid, tok = _mk_user_session(f"TEST_mgmt_{uuid.uuid4().hex[:6]}@example.com", "management")
    return {"uid": uid, "token": tok, "hdr": _hdr(tok)}


@pytest.fixture(scope="module")
def project_ctx(admin):
    """Create a project used across tests."""
    r = requests.post(f"{BASE_URL}/api/projects", headers=admin["hdr"],
                      json={"name": "TEST_Proj_A", "location": "BLR",
                            "description": "auto", "target_revenue": 10000000})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def site_manager(project_ctx):
    uid, tok = _mk_user_session(
        f"TEST_sm_{uuid.uuid4().hex[:6]}@example.com", "site_manager",
        project_ids=[project_ctx["project_id"]])
    return {"uid": uid, "token": tok, "hdr": _hdr(tok),
            "project_id": project_ctx["project_id"]}


# ---------------------------------------------------------- health/auth ---
class TestAuth:
    def test_settings_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 401

    def test_me_with_token(self, admin):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin["hdr"])
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "admin"
        assert data["user_id"] == admin["uid"]

    def test_me_invalid_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": "Bearer invalid_xxx"})
        assert r.status_code == 401

    def test_settings_with_auth(self, admin):
        r = requests.get(f"{BASE_URL}/api/settings", headers=admin["hdr"])
        assert r.status_code == 200
        d = r.json()
        assert d["approval_threshold"] == 50000
        assert d["currency"] == "INR"


# ----------------------------------------------------- projects & RBAC ----
class TestProjects:
    def test_admin_list(self, admin, project_ctx):
        r = requests.get(f"{BASE_URL}/api/projects", headers=admin["hdr"])
        assert r.status_code == 200
        assert any(p["project_id"] == project_ctx["project_id"] for p in r.json())

    def test_sitemgr_cannot_create(self, site_manager):
        r = requests.post(f"{BASE_URL}/api/projects", headers=site_manager["hdr"],
                          json={"name": "SM shouldn't create"})
        assert r.status_code == 403

    def test_sitemgr_sees_only_assigned(self, admin, site_manager):
        # create a second project not assigned to sitemgr
        requests.post(f"{BASE_URL}/api/projects", headers=admin["hdr"],
                      json={"name": "TEST_Proj_Unassigned"})
        r = requests.get(f"{BASE_URL}/api/projects", headers=site_manager["hdr"])
        assert r.status_code == 200
        ids = [p["project_id"] for p in r.json()]
        assert site_manager["project_id"] in ids
        assert all(pid == site_manager["project_id"] for pid in ids)


# --------------------------------------------------- unit types & units ---
class TestUnits:
    def test_create_unit_type_and_unit(self, admin, project_ctx):
        r = requests.post(f"{BASE_URL}/api/unit-types", headers=admin["hdr"],
                          json={"project_id": project_ctx["project_id"],
                                "name": "2BHK", "default_price": 5000000})
        assert r.status_code == 200
        ut = r.json()

        r2 = requests.post(f"{BASE_URL}/api/units", headers=admin["hdr"],
                           json={"project_id": project_ctx["project_id"],
                                 "unit_type_id": ut["unit_type_id"],
                                 "unit_number": "A-101", "price": 5200000})
        assert r2.status_code == 200
        u = r2.json()
        assert u["status"] == "available"
        pytest.unit_id = u["unit_id"]

    def test_list_units(self, admin, project_ctx):
        r = requests.get(f"{BASE_URL}/api/units",
                         params={"project_id": project_ctx["project_id"]},
                         headers=admin["hdr"])
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_mark_unit_sold(self, admin):
        r = requests.post(f"{BASE_URL}/api/units/{pytest.unit_id}/sell",
                          headers=admin["hdr"],
                          json={"buyer_name": "Ravi",
                                "buyer_contact": "9999999999",
                                "total_price": 5200000})
        assert r.status_code == 200
        assert r.json()["status"] == "sold"


# ---------------------------------------------------------- payments -----
class TestPayments:
    def test_accounts_records_payment(self, accounts):
        r = requests.post(f"{BASE_URL}/api/payments", headers=accounts["hdr"],
                          json={"unit_id": pytest.unit_id, "amount": 2000000,
                                "mode": "bank_transfer", "reference": "TXN1",
                                "paid_on": "2026-01-15"})
        assert r.status_code == 200, r.text

    def test_revenue_summary(self, admin):
        r = requests.get(f"{BASE_URL}/api/revenue/summary", headers=admin["hdr"])
        assert r.status_code == 200
        d = r.json()
        assert d["accrued"] >= 5200000
        assert d["received"] >= 2000000
        assert d["receivable"] == d["accrued"] - d["received"]


# ---------------------------------------------------------- expenses ------
class TestExpenses:
    def test_sitemgr_raises_small_expense_auto_finalises(
            self, site_manager, accounts):
        r = requests.post(f"{BASE_URL}/api/expenses", headers=site_manager["hdr"],
                          json={"project_id": site_manager["project_id"],
                                "category": "materials",
                                "amount": 20000, "vendor": "V1",
                                "description": "cement"})
        assert r.status_code == 200
        eid = r.json()["expense_id"]
        # accounts approves stage1 -> small amount auto-finalises
        r2 = requests.post(f"{BASE_URL}/api/expenses/{eid}/stage1",
                           headers=accounts["hdr"],
                           json={"action": "approve"})
        assert r2.status_code == 200
        assert r2.json()["status"] == "final_approved"

    def test_large_expense_requires_management(
            self, site_manager, accounts, management):
        r = requests.post(f"{BASE_URL}/api/expenses", headers=site_manager["hdr"],
                          json={"project_id": site_manager["project_id"],
                                "category": "labour", "amount": 200000,
                                "vendor": "V2", "description": "big"})
        eid = r.json()["expense_id"]
        r2 = requests.post(f"{BASE_URL}/api/expenses/{eid}/stage1",
                           headers=accounts["hdr"], json={"action": "approve"})
        assert r2.status_code == 200
        assert r2.json()["status"] == "stage1_approved"
        # accounts cannot final approve
        r3 = requests.post(f"{BASE_URL}/api/expenses/{eid}/final",
                           headers=accounts["hdr"], json={"action": "approve"})
        assert r3.status_code == 403
        # management can
        r4 = requests.post(f"{BASE_URL}/api/expenses/{eid}/final",
                           headers=management["hdr"], json={"action": "approve"})
        assert r4.status_code == 200
        assert r4.json()["status"] == "final_approved"

    def test_rejection_flow(self, site_manager, accounts):
        r = requests.post(f"{BASE_URL}/api/expenses", headers=site_manager["hdr"],
                          json={"project_id": site_manager["project_id"],
                                "category": "misc", "amount": 30000})
        eid = r.json()["expense_id"]
        r2 = requests.post(f"{BASE_URL}/api/expenses/{eid}/stage1",
                           headers=accounts["hdr"],
                           json={"action": "reject", "reason": "no docs"})
        assert r2.status_code == 200
        d = r2.json()
        assert d["status"] == "rejected"
        assert d["rejection_reason"] == "no docs"
        assert d["rejected_by"] == accounts["uid"]

    def test_reject_without_reason_400(self, site_manager, accounts):
        r = requests.post(f"{BASE_URL}/api/expenses", headers=site_manager["hdr"],
                          json={"project_id": site_manager["project_id"],
                                "category": "misc", "amount": 100})
        eid = r.json()["expense_id"]
        r2 = requests.post(f"{BASE_URL}/api/expenses/{eid}/stage1",
                           headers=accounts["hdr"], json={"action": "reject"})
        assert r2.status_code == 400

    def test_sitemgr_cannot_raise_on_other_project(self, site_manager):
        r = requests.post(f"{BASE_URL}/api/expenses", headers=site_manager["hdr"],
                          json={"project_id": "proj_not_mine",
                                "category": "x", "amount": 1})
        assert r.status_code == 403


# ------------------------------------------------------- notifications ---
class TestNotifications:
    def test_notifications_listed(self, site_manager):
        r = requests.get(f"{BASE_URL}/api/notifications",
                         headers=site_manager["hdr"])
        assert r.status_code == 200
        # site manager should have result notifications from approvals/rejections
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1


# --------------------------------------------------------------- stock ---
class TestStock:
    def test_stock_flow_and_closing(self, site_manager):
        r = requests.post(f"{BASE_URL}/api/stock/items",
                          headers=site_manager["hdr"],
                          json={"project_id": site_manager["project_id"],
                                "name": "Cement Bag", "unit": "bag",
                                "opening": 100, "vendor": "ACC"})
        assert r.status_code == 200
        item_id = r.json()["item_id"]

        # inward 50
        r2 = requests.post(f"{BASE_URL}/api/stock/movements",
                           headers=site_manager["hdr"],
                           json={"item_id": item_id, "kind": "inward",
                                 "quantity": 50, "note": "delivery"})
        assert r2.status_code == 200

        # outward 30
        r3 = requests.post(f"{BASE_URL}/api/stock/movements",
                           headers=site_manager["hdr"],
                           json={"item_id": item_id, "kind": "outward",
                                 "quantity": 30, "note": "used"})
        assert r3.status_code == 200

        r4 = requests.get(f"{BASE_URL}/api/stock/items",
                          params={"project_id": site_manager["project_id"]},
                          headers=site_manager["hdr"])
        assert r4.status_code == 200
        item = next(i for i in r4.json() if i["item_id"] == item_id)
        assert item["closing"] == 120  # 100 + 50 - 30


# --------------------------------------------------------------- users ---
class TestUsers:
    def test_admin_creates_user(self, admin):
        email = f"TEST_new_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{BASE_URL}/api/users", headers=admin["hdr"],
                          json={"email": email, "name": "New",
                                "role": "accounts", "project_ids": []})
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == email.lower()
        # toggle inactive
        r2 = requests.patch(f"{BASE_URL}/api/users/{u['user_id']}",
                            headers=admin["hdr"],
                            json={"is_active": False})
        assert r2.status_code == 200
        assert r2.json()["is_active"] is False

    def test_sitemgr_cannot_list_users(self, site_manager):
        r = requests.get(f"{BASE_URL}/api/users", headers=site_manager["hdr"])
        assert r.status_code == 403

    def test_sitemgr_cannot_create_users(self, site_manager):
        r = requests.post(f"{BASE_URL}/api/users", headers=site_manager["hdr"],
                          json={"email": "x@y.com", "name": "x", "role": "accounts"})
        assert r.status_code == 403


# ------------------------------------------------------------ settings ---
class TestSettings:
    def test_patch_settings(self, admin):
        r = requests.patch(f"{BASE_URL}/api/settings", headers=admin["hdr"],
                           json={"approval_threshold": 75000,
                                 "company_name": "TestCo",
                                 "currency": "INR"})
        assert r.status_code == 200
        assert r.json()["approval_threshold"] == 75000
        # reset
        requests.patch(f"{BASE_URL}/api/settings", headers=admin["hdr"],
                       json={"approval_threshold": 50000})


# ---------------------------------------------------- excel & audit ------
class TestExcel:
    def test_template_download(self, admin):
        r = requests.get(f"{BASE_URL}/api/excel/template/projects",
                         headers=admin["hdr"])
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("content-type", "")

    def test_import_projects(self, admin):
        wb = Workbook()
        ws = wb.active
        ws.append(["name", "location", "description", "target_revenue"])
        ws.append(["TEST_ImportedProj", "MUM", "desc", 100000])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        files = {"file": ("t.xlsx", buf.getvalue(),
                          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        # Bearer token via header (no Content-Type json)
        r = requests.post(f"{BASE_URL}/api/excel/import/projects",
                          headers={"Authorization": f"Bearer {admin['token']}"},
                          files=files)
        assert r.status_code == 200, r.text
        assert r.json()["inserted"] == 1


class TestAuditAndSearch:
    def test_audit_logs(self, admin):
        r = requests.get(f"{BASE_URL}/api/audit-logs", headers=admin["hdr"])
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_search(self, admin):
        r = requests.get(f"{BASE_URL}/api/search",
                         params={"q": "TEST"}, headers=admin["hdr"])
        assert r.status_code == 200
        d = r.json()
        assert "projects" in d and "units" in d and "expenses" in d


class TestDashboard:
    def test_summary(self, admin):
        r = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=admin["hdr"])
        assert r.status_code == 200
        d = r.json()
        for k in ["units", "revenue", "expenses", "expense_trend", "projects_count"]:
            assert k in d
        assert d["units"]["total"] >= 1
