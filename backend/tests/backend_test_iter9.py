"""Iter9 backend tests — Agrocorp clean-break rework.
Covers: forced pw reset flow, onboarding 7-step status, user roles (6),
projects (2 types only), payment templates, units + sell, installments
lifecycle (initiate/reflect), tickets, bulk-import template, RBAC.
"""
import io
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sales@agrocorp.co.in"
ADMIN_TEMP = "ot3C4qbfb91YJa"
ADMIN_NEW = "Agrocorp@2026#"


# ------------------------------------------------------- session fixtures
@pytest.fixture(scope="session")
def admin_token():
    # Try rotated pw first (idempotent across reruns)
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_NEW})
    if r.status_code == 200:
        return r.json()["access_token"]
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_TEMP})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    body = r.json()
    tok = body["access_token"]
    assert body.get("must_reset_password") is True, body
    # rotate
    rr = requests.post(f"{API}/auth/change-password",
                       headers={"Authorization": f"Bearer {tok}"},
                       json={"current_password": ADMIN_TEMP,
                             "new_password": ADMIN_NEW})
    assert rr.status_code == 200, rr.text
    r2 = requests.post(f"{API}/auth/login",
                       json={"email": ADMIN_EMAIL, "password": ADMIN_NEW})
    return r2.json()["access_token"]


@pytest.fixture(scope="session")
def H(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


_ctx: dict = {}


# ---------------------------------------------------------- auth / me
class TestAuthMe:
    def test_me_after_reset(self, H):
        r = requests.get(f"{API}/auth/me", headers=H)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == ADMIN_EMAIL
        assert d["role"] == "admin"
        assert d["must_reset_password"] is False


# ---------------------------------------------------------- onboarding
class TestOnboarding:
    def test_status_has_7_steps(self, H):
        r = requests.get(f"{API}/onboarding/status", headers=H)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total_steps"] == 7
        keys = [s["key"] for s in d["steps"]]
        assert keys == ["password_reset", "add_management", "add_accounts",
                        "add_sales", "add_crm", "add_project",
                        "assign_site_manager"]
        # password_reset must be done since we rotated
        assert d["steps"][0]["done"] is True


# ---------------------------------------------------------- users / roles
class TestUsersRoles:
    @pytest.mark.parametrize("role",
                             ["management", "accounts", "sales", "crm",
                              "site_manager"])
    def test_create_user_with_role(self, H, role):
        email = f"sales+it9{role}{uuid.uuid4().hex[:4]}@agrocorp.co.in"
        r = requests.post(f"{API}/users", headers=H,
                          json={"email": email, "name": f"TEST_{role}",
                                "role": role, "project_ids": []})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == role
        assert d["user"]["must_reset_password"] is True
        assert "temp_password" in d

    def test_reject_bad_role(self, H):
        email = f"sales+bad{uuid.uuid4().hex[:4]}@agrocorp.co.in"
        r = requests.post(f"{API}/users", headers=H,
                          json={"email": email, "name": "X", "role": "ceo"})
        assert r.status_code == 422


# ---------------------------------------------------------- projects
class TestProjects:
    def test_project_types_schema(self, H):
        r = requests.get(f"{API}/projects/types", headers=H)
        assert r.status_code == 200
        d = r.json()
        assert set(d.keys()) == {"residential", "plots_land"}

    def test_create_residential(self, H, request):
        name = f"TEST_Proj_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/projects", headers=H,
                          json={"name": name,
                                "project_type": "residential",
                                "city": "Bangalore",
                                "developer": "Agrocorp"})
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["project_type"] == "residential"
        assert "target_revenue" not in p or p.get("target_revenue") in (None, 0)
        assert "description" not in p or p.get("description") in (None, "")
        _ctx["proj_id"] = p["project_id"]

    def test_reject_villa_type(self, H):
        r = requests.post(f"{API}/projects", headers=H,
                          json={"name": "TEST_bad",
                                "project_type": "villa"})
        assert r.status_code == 422


# ---------------------------------------------------------- payment tpl
class TestPaymentTemplates:
    def test_create_template_sum_100(self, H, request):
        r = requests.post(f"{API}/payment-templates", headers=H,
                          json={"name": f"TEST_Tpl_{uuid.uuid4().hex[:4]}",
                                "description": "3-stage",
                                "stages": [
                                    {"name": "Booking", "percent": 10, "days_from_start": 0},
                                    {"name": "Foundation", "percent": 40, "days_from_start": 60},
                                    {"name": "Handover", "percent": 50, "days_from_start": 180},
                                ]})
        assert r.status_code == 200, r.text
        _ctx["tpl_id"] = r.json()["template_id"]

    def test_reject_not_100(self, H):
        r = requests.post(f"{API}/payment-templates", headers=H,
                          json={"name": "TEST_bad",
                                "stages": [{"name": "a", "percent": 30, "days_from_start": 0}]})
        assert r.status_code == 400

    def test_list(self, H):
        r = requests.get(f"{API}/payment-templates", headers=H)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------------------------------------------------- units + sell + installments
class TestSaleFlow:
    def test_create_unit(self, H, request):
        pid = _ctx.get("proj_id")
        assert pid, "project must exist"
        r = requests.post(f"{API}/units", headers=H,
                          json={"project_id": pid,
                                "plot_number": f"P-{uuid.uuid4().hex[:4]}",
                                "size": "1200 sqft",
                                "facing": "North-East",
                                "price": 5000000,
                                "plcs": [{"label": "Corner", "amount": 100000}]})
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["status"] == "available"
        assert len(u["plcs"]) == 1
        _ctx["unit_id"] = u["unit_id"]

    def test_sell_unit(self, H, request):
        uid = _ctx.get("unit_id")
        tpl = _ctx.get("tpl_id")
        r = requests.post(f"{API}/units/{uid}/sell", headers=H,
                          json={"owner_name": "TEST_Buyer",
                                "owner_contact": "9999",
                                "owner_email": "buy@x.com",
                                "discount": 0,
                                "total_price": 5100000,
                                "payment_plan_template_id": tpl})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "crm_pending"

    def test_double_sell_rejected(self, H, request):
        uid = _ctx.get("unit_id")
        r = requests.post(f"{API}/units/{uid}/sell", headers=H,
                          json={"owner_name": "X", "total_price": 1})
        assert r.status_code == 400

    def test_create_schedule(self, H, request):
        uid = _ctx.get("unit_id")
        r = requests.post(f"{API}/units/{uid}/installments", headers=H,
                          json=[
                              {"stage_name": "Booking", "percent": 10,
                               "amount": 510000, "due_date": "2026-02-01"},
                              {"stage_name": "Foundation", "percent": 40,
                               "amount": 2040000, "due_date": "2026-04-01"},
                              {"stage_name": "Handover", "percent": 50,
                               "amount": 2550000, "due_date": "2026-08-01"},
                          ])
        assert r.status_code == 200
        assert r.json()["created"] == 3
        # unit status → crm_scheduled
        units = requests.get(f"{API}/units", headers=H).json()
        u = next(x for x in units if x["unit_id"] == uid)
        assert u["status"] == "crm_scheduled"

    def test_initiate_and_reflect(self, H, request):
        uid = _ctx.get("unit_id")
        insts = requests.get(f"{API}/units/{uid}/installments", headers=H).json()
        assert len(insts) == 3
        iid = insts[0]["installment_id"]
        r1 = requests.post(f"{API}/installments/{iid}/initiate", headers=H)
        assert r1.status_code == 200, r1.text
        assert r1.json()["status"] == "initiated"
        # Unit moves to accounts_tracking
        u_after = next(x for x in requests.get(f"{API}/units",
                       headers=H).json() if x["unit_id"] == uid)
        assert u_after["status"] == "accounts_tracking"

        r2 = requests.post(f"{API}/installments/{iid}/reflect", headers=H)
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] == "reflected"
        # payment recorded
        pays = requests.get(f"{API}/payments?unit_id={uid}",
                            headers=H).json()
        assert any(abs(p["amount"] - 510000) < 1 for p in pays)


# ---------------------------------------------------------- tickets
class TestTickets:
    def test_create_and_resolve(self, H, request):
        pid = _ctx.get("proj_id")
        r = requests.post(f"{API}/tickets", headers=H,
                          json={"project_id": pid,
                                "subject": "TEST_ticket",
                                "severity": "high"})
        assert r.status_code == 200, r.text
        tid = r.json()["ticket_id"]
        rr = requests.patch(f"{API}/tickets/{tid}", headers=H,
                            json={"status": "resolved",
                                  "resolution_note": "fixed"})
        assert rr.status_code == 200
        assert rr.json()["status"] == "resolved"


# ---------------------------------------------------------- bulk template
class TestBulkImport:
    def test_download_template(self, H):
        r = requests.get(f"{API}/units/bulk-template", headers=H)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith(
            "application/vnd.openxmlformats")
        assert len(r.content) > 100


# ---------------------------------------------------------- RBAC
class TestRBAC:
    def test_sales_cannot_create_project(self, H):
        email = f"sales+rbac{uuid.uuid4().hex[:4]}@agrocorp.co.in"
        c = requests.post(f"{API}/users", headers=H,
                          json={"email": email, "name": "S",
                                "role": "sales"}).json()
        temp = c["temp_password"]
        tok = requests.post(f"{API}/auth/login",
                            json={"email": email,
                                  "password": temp}).json()["access_token"]
        new_pw = "SalesStrong#Pass2026"
        requests.post(f"{API}/auth/change-password",
                      headers={"Authorization": f"Bearer {tok}"},
                      json={"current_password": temp,
                            "new_password": new_pw})
        tok2 = requests.post(f"{API}/auth/login",
                             json={"email": email,
                                   "password": new_pw}).json()["access_token"]
        r = requests.post(f"{API}/projects",
                          headers={"Authorization": f"Bearer {tok2}"},
                          json={"name": "TEST_shouldfail",
                                "project_type": "residential"})
        assert r.status_code == 403
        # But sales CAN see units
        r2 = requests.get(f"{API}/units",
                          headers={"Authorization": f"Bearer {tok2}"})
        assert r2.status_code == 200
