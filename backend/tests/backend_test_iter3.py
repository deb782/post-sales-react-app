"""Iteration 3 backend tests: Revenue Targets (monthly/quarterly),
variance series, and dashboard period_targets integration.

Seeds its own TEST3_-prefixed users/projects and does not wipe DB.
"""
import os
import uuid
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


def _month_key(dt):
    return dt.strftime("%Y-%m")


def _quarter_key(dt):
    q = (dt.month - 1) // 3 + 1
    return f"{dt.year}-Q{q}"


def _shift_month(dt, months):
    # naive month shifter
    y = dt.year
    m = dt.month + months
    while m <= 0:
        m += 12
        y -= 1
    while m > 12:
        m -= 12
        y += 1
    return dt.replace(year=y, month=m, day=1)


@pytest.fixture(scope="module")
def now_utc():
    return datetime.now(timezone.utc)


@pytest.fixture(scope="module")
def admin():
    uid, tok = _mk_session(f"TEST3_admin_{uuid.uuid4().hex[:6]}@example.com", "admin")
    return {"uid": uid, "token": tok, "hdr": _hdr(tok)}


@pytest.fixture(scope="module")
def accounts():
    uid, tok = _mk_session(f"TEST3_acc_{uuid.uuid4().hex[:6]}@example.com", "accounts")
    return {"uid": uid, "token": tok, "hdr": _hdr(tok)}


@pytest.fixture(scope="module")
def management():
    uid, tok = _mk_session(f"TEST3_mgmt_{uuid.uuid4().hex[:6]}@example.com", "management")
    return {"uid": uid, "token": tok, "hdr": _hdr(tok)}


@pytest.fixture(scope="module")
def project(admin):
    r = requests.post(f"{BASE_URL}/api/projects", headers=admin["hdr"],
                      json={"name": f"TEST3_Proj_{uuid.uuid4().hex[:6]}",
                            "target_revenue": 5000000})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def project_other(admin):
    """Second project not assigned to site_manager, for scope tests."""
    r = requests.post(f"{BASE_URL}/api/projects", headers=admin["hdr"],
                      json={"name": f"TEST3_ProjOther_{uuid.uuid4().hex[:6]}",
                            "target_revenue": 1000000})
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def site_manager(project):
    uid, tok = _mk_session(
        f"TEST3_sm_{uuid.uuid4().hex[:6]}@example.com", "site_manager",
        project_ids=[project["project_id"]])
    return {"uid": uid, "token": tok, "hdr": _hdr(tok)}


# ------------------------------------------------------- CRUD / RBAC ------
class TestTargetsCRUD:
    def test_create_target_admin(self, admin, project):
        pid = project["project_id"]
        r = requests.post(f"{BASE_URL}/api/revenue-targets",
                          headers=admin["hdr"],
                          json={"project_id": pid, "period_type": "monthly",
                                "period_key": "2026-02", "amount": 500000})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["project_id"] == pid
        assert d["period_key"] == "2026-02"
        assert d["period_type"] == "monthly"
        assert d["amount"] == 500000
        assert d["target_id"].startswith("tgt_")
        TestTargetsCRUD.target_id = d["target_id"]

    def test_upsert_same_period_returns_same_id(self, admin, project):
        pid = project["project_id"]
        r = requests.post(f"{BASE_URL}/api/revenue-targets",
                          headers=admin["hdr"],
                          json={"project_id": pid, "period_type": "monthly",
                                "period_key": "2026-02", "amount": 700000})
        assert r.status_code == 200
        d = r.json()
        assert d["target_id"] == TestTargetsCRUD.target_id
        assert d["amount"] == 700000

        # persistence: GET back
        gr = requests.get(f"{BASE_URL}/api/revenue-targets",
                          params={"project_id": pid, "period_type": "monthly"},
                          headers=admin["hdr"])
        assert gr.status_code == 200
        found = [t for t in gr.json() if t["target_id"] == d["target_id"]]
        assert len(found) == 1
        assert found[0]["amount"] == 700000

    def test_create_target_missing_project_404(self, admin):
        r = requests.post(f"{BASE_URL}/api/revenue-targets",
                          headers=admin["hdr"],
                          json={"project_id": "proj_does_not_exist",
                                "period_type": "monthly",
                                "period_key": "2026-03", "amount": 100})
        assert r.status_code == 404

    def test_create_target_forbidden_for_accounts(self, accounts, project):
        r = requests.post(f"{BASE_URL}/api/revenue-targets",
                          headers=accounts["hdr"],
                          json={"project_id": project["project_id"],
                                "period_type": "monthly",
                                "period_key": "2026-04", "amount": 1})
        assert r.status_code == 403

    def test_create_target_forbidden_for_site_manager(self, site_manager, project):
        r = requests.post(f"{BASE_URL}/api/revenue-targets",
                          headers=site_manager["hdr"],
                          json={"project_id": project["project_id"],
                                "period_type": "monthly",
                                "period_key": "2026-05", "amount": 1})
        assert r.status_code == 403

    def test_create_target_forbidden_for_management(self, management, project):
        r = requests.post(f"{BASE_URL}/api/revenue-targets",
                          headers=management["hdr"],
                          json={"project_id": project["project_id"],
                                "period_type": "monthly",
                                "period_key": "2026-06", "amount": 1})
        assert r.status_code == 403

    def test_list_filters(self, admin, project):
        # create a quarterly one too
        requests.post(f"{BASE_URL}/api/revenue-targets", headers=admin["hdr"],
                      json={"project_id": project["project_id"],
                            "period_type": "quarterly",
                            "period_key": "2026-Q1", "amount": 1500000})
        r = requests.get(f"{BASE_URL}/api/revenue-targets",
                         params={"project_id": project["project_id"],
                                 "period_type": "quarterly"},
                         headers=admin["hdr"])
        assert r.status_code == 200
        for t in r.json():
            assert t["period_type"] == "quarterly"
            assert t["project_id"] == project["project_id"]

    def test_delete_admin_only(self, admin, accounts, project):
        # create disposable
        r = requests.post(f"{BASE_URL}/api/revenue-targets",
                          headers=admin["hdr"],
                          json={"project_id": project["project_id"],
                                "period_type": "monthly",
                                "period_key": "2027-01", "amount": 999})
        tid = r.json()["target_id"]

        # accounts forbidden
        r2 = requests.delete(f"{BASE_URL}/api/revenue-targets/{tid}",
                             headers=accounts["hdr"])
        assert r2.status_code == 403

        # admin succeeds
        r3 = requests.delete(f"{BASE_URL}/api/revenue-targets/{tid}",
                             headers=admin["hdr"])
        assert r3.status_code == 200

        # 404 second time
        r4 = requests.delete(f"{BASE_URL}/api/revenue-targets/{tid}",
                             headers=admin["hdr"])
        assert r4.status_code == 404


# ---------------------------------------------------------- SCOPE --------
class TestTargetScope:
    def test_site_manager_list_scoped(self, admin, site_manager, project, project_other):
        # add a target to the OTHER project (not assigned to SM)
        requests.post(f"{BASE_URL}/api/revenue-targets", headers=admin["hdr"],
                      json={"project_id": project_other["project_id"],
                            "period_type": "monthly",
                            "period_key": "2026-02", "amount": 111})
        r = requests.get(f"{BASE_URL}/api/revenue-targets",
                         headers=site_manager["hdr"])
        assert r.status_code == 200
        pids = {t["project_id"] for t in r.json()}
        assert project_other["project_id"] not in pids
        # sm's assigned project may or may not have targets — just ensure no
        # unauthorised project shows up.


# -------------------------------------------------------- VARIANCE -------
class TestVariance:
    """Seed 2 monthly targets + payments across 3 months + 2 sold units in
    2 different months on an ISOLATED project, then verify the variance series."""

    @pytest.fixture(scope="class")
    def iso_project(self, admin):
        r = requests.post(f"{BASE_URL}/api/projects", headers=admin["hdr"],
                          json={"name": f"TEST3_Var_{uuid.uuid4().hex[:6]}",
                                "target_revenue": 1000000})
        return r.json()

    @pytest.fixture(scope="class")
    def seeded(self, admin, iso_project, now_utc):
        pid = iso_project["project_id"]
        this_month = now_utc.replace(day=1)
        last_month = _shift_month(this_month, -1)
        two_months_ago = _shift_month(this_month, -2)

        # Create 3 units - we will mark 2 as sold with specific sold_at
        unit_ids = []
        for n in range(3):
            r = requests.post(f"{BASE_URL}/api/units", headers=admin["hdr"],
                              json={"project_id": pid,
                                    "unit_number": f"V-{uuid.uuid4().hex[:4]}",
                                    "price": 300000})
            unit_ids.append(r.json()["unit_id"])

        # Sell unit[0] with sold_at = this_month (price 300000)
        # Sell unit[1] with sold_at = last_month (price 400000)
        # We'll sell via API then patch sold_at + price directly in Mongo to
        # place them in exact months
        for uid_, price, sold_dt in [
            (unit_ids[0], 300000, this_month),
            (unit_ids[1], 400000, last_month),
        ]:
            requests.post(f"{BASE_URL}/api/units/{uid_}/sell",
                          headers=admin["hdr"],
                          json={"buyer_name": "B", "total_price": price})
            db.units.update_one({"unit_id": uid_},
                                {"$set": {"sold_at": sold_dt.replace(
                                    hour=12).isoformat(),
                                          "price": price}})

        # Payments: 3 spread across current, last_month, two_months_ago
        pay_specs = [
            (unit_ids[0], 100000, this_month),
            (unit_ids[1], 200000, last_month),
            (unit_ids[1], 50000, two_months_ago),
        ]
        for uid_, amt, when in pay_specs:
            r = requests.post(f"{BASE_URL}/api/payments", headers=admin["hdr"],
                              json={"unit_id": uid_, "amount": amt,
                                    "mode": "bank_transfer",
                                    "paid_on": when.strftime("%Y-%m-%d")})
            assert r.status_code == 200, r.text

        # Targets: last_month = 300000, this_month = 500000
        for when, amt in [(last_month, 300000), (this_month, 500000)]:
            requests.post(f"{BASE_URL}/api/revenue-targets",
                          headers=admin["hdr"],
                          json={"project_id": pid,
                                "period_type": "monthly",
                                "period_key": _month_key(when),
                                "amount": amt})

        return {
            "pid": pid,
            "this_month_key": _month_key(this_month),
            "last_month_key": _month_key(last_month),
            "two_months_ago_key": _month_key(two_months_ago),
        }

    def test_variance_shape_and_sorted(self, admin, seeded):
        r = requests.get(f"{BASE_URL}/api/revenue-targets/variance",
                         params={"project_id": seeded["pid"],
                                 "period_type": "monthly", "periods": 6},
                         headers=admin["hdr"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["period_type"] == "monthly"
        assert len(d["series"]) == 6
        # oldest first
        keys = [s["period_key"] for s in d["series"]]
        assert keys == sorted(keys)
        # each has expected shape
        for s in d["series"]:
            for k in ("period_key", "target", "received", "accrued",
                      "variance_received", "variance_accrued",
                      "variance_received_pct", "variance_accrued_pct"):
                assert k in s

    def test_variance_math_current_month(self, admin, seeded):
        r = requests.get(f"{BASE_URL}/api/revenue-targets/variance",
                         params={"project_id": seeded["pid"],
                                 "period_type": "monthly", "periods": 6},
                         headers=admin["hdr"])
        series = {s["period_key"]: s for s in r.json()["series"]}
        cm = series[seeded["this_month_key"]]
        assert cm["target"] == 500000
        assert cm["received"] == 100000
        assert cm["accrued"] == 300000
        assert cm["variance_received"] == 100000 - 500000
        assert cm["variance_accrued"] == 300000 - 500000
        assert cm["variance_received_pct"] == round((100000 - 500000) / 500000 * 100, 1)
        assert cm["variance_accrued_pct"] == round((300000 - 500000) / 500000 * 100, 1)

    def test_variance_math_last_month(self, admin, seeded):
        r = requests.get(f"{BASE_URL}/api/revenue-targets/variance",
                         params={"project_id": seeded["pid"],
                                 "period_type": "monthly", "periods": 6},
                         headers=admin["hdr"])
        series = {s["period_key"]: s for s in r.json()["series"]}
        lm = series[seeded["last_month_key"]]
        assert lm["target"] == 300000
        assert lm["received"] == 200000
        assert lm["accrued"] == 400000

    def test_variance_pct_null_when_target_zero(self, admin, seeded):
        r = requests.get(f"{BASE_URL}/api/revenue-targets/variance",
                         params={"project_id": seeded["pid"],
                                 "period_type": "monthly", "periods": 6},
                         headers=admin["hdr"])
        series = {s["period_key"]: s for s in r.json()["series"]}
        # two_months_ago has no target — pct should be null
        tma = series.get(seeded["two_months_ago_key"])
        assert tma is not None
        assert tma["target"] == 0
        assert tma["variance_received_pct"] is None
        assert tma["variance_accrued_pct"] is None

    def test_variance_quarterly_period_key_format(self, admin, seeded):
        r = requests.get(f"{BASE_URL}/api/revenue-targets/variance",
                         params={"project_id": seeded["pid"],
                                 "period_type": "quarterly", "periods": 4},
                         headers=admin["hdr"])
        assert r.status_code == 200
        for s in r.json()["series"]:
            assert "-Q" in s["period_key"]
            y, q = s["period_key"].split("-Q")
            assert len(y) == 4 and y.isdigit()
            assert q in ("1", "2", "3", "4")


# ---------------------------------------------- DASHBOARD SUMMARY --------
class TestDashboardPeriodTargets:
    def test_summary_has_period_targets(self, admin):
        r = requests.get(f"{BASE_URL}/api/dashboard/summary",
                         headers=admin["hdr"])
        assert r.status_code == 200
        d = r.json()
        assert "period_targets" in d
        pt = d["period_targets"]
        assert "monthly" in pt and "quarterly" in pt
        for kind in ("monthly", "quarterly"):
            for k in ("period_key", "target", "received", "accrued",
                      "variance_received", "variance_accrued",
                      "variance_received_pct", "variance_accrued_pct"):
                assert k in pt[kind], f"{kind} missing {k}"
        # quarter key format
        assert "-Q" in pt["quarterly"]["period_key"]

    def test_site_manager_summary_scoped(self, site_manager):
        r = requests.get(f"{BASE_URL}/api/dashboard/summary",
                         headers=site_manager["hdr"])
        assert r.status_code == 200
        pt = r.json()["period_targets"]
        # target/received/accrued must be numbers (site manager scope may
        # yield zeros — just verify structure and non-null numeric).
        for kind in ("monthly", "quarterly"):
            assert isinstance(pt[kind]["target"], (int, float))
            assert isinstance(pt[kind]["received"], (int, float))
            assert isinstance(pt[kind]["accrued"], (int, float))
