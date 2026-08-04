"""
Iter14 — Wave 2 Backend Tests
Covers: Booking Cancellation + Refund workflow, Site Material Request chain,
Reminder Engine cron endpoints, RBAC guardrails, idempotency.
"""
import os
import uuid
import datetime
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL}/api"

SUPER_EMAIL = "deb@agrocorp.co.in"
SUPER_PW_CANDIDATES = ["Admin@Agro@2026#", "Agrocorp@2026#"]

# Read WEBHOOK_CRON_SECRET from backend/.env
def _read_cron_secret():
    try:
        with open("/app/backend/.env") as f:
            for line in f:
                if line.startswith("WEBHOOK_CRON_SECRET"):
                    val = line.split("=", 1)[1].strip()
                    return val.strip('"').strip("'")
    except Exception:
        return None
    return None


CRON_SECRET = _read_cron_secret()
RUN_TAG = uuid.uuid4().hex[:6]

ROLES_TO_CREATE = [
    "process_admin", "crm_head", "sales_head", "accounts_head",
    "sales_rep", "post_sales_rep", "accounts_rep", "site_supervisor",
]


def _login(email, password):
    return requests.post(f"{API}/auth/login", json={"email": email, "password": password})


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------- fixtures
@pytest.fixture(scope="session")
def super_token():
    for pw in SUPER_PW_CANDIDATES:
        r = _login(SUPER_EMAIL, pw)
        if r.status_code == 200:
            data = r.json()
            token = data["access_token"]
            if data.get("must_reset_password"):
                # try to set to a stronger password and re-login
                new_pw = "Agrocorp@2026#"
                rr = requests.post(f"{API}/auth/change-password", headers=_hdr(token),
                                   json={"current_password": pw, "new_password": new_pw})
                if rr.status_code == 200:
                    r2 = _login(SUPER_EMAIL, new_pw)
                    if r2.status_code == 200:
                        return r2.json()["access_token"]
            return token
    pytest.skip("Super admin login failed with both candidate passwords")


@pytest.fixture(scope="session")
def created_users(super_token):
    out = {}
    for role in ROLES_TO_CREATE:
        email = f"w2_{role}_{RUN_TAG}@example.com"
        r = requests.post(f"{API}/users", headers=_hdr(super_token),
                          json={"email": email, "name": f"W2 {role}", "role": role})
        assert r.status_code == 200, f"create {role}: {r.status_code} {r.text}"
        j = r.json()
        out[role] = {"user_id": j["user"]["user_id"], "email": email,
                     "temp_password": j["temp_password"]}
    return out


def _role_token(created_users, role):
    info = created_users[role]
    pw = info.get("password") or info["temp_password"]
    r = _login(info["email"], pw)
    assert r.status_code == 200, f"login {role}: {r.text}"
    j = r.json()
    tok = j["access_token"]
    if j.get("must_reset_password"):
        new_pw = f"W2@Role@{RUN_TAG}#1"
        rr = requests.post(f"{API}/auth/change-password", headers=_hdr(tok),
                           json={"current_password": info["temp_password"], "new_password": new_pw})
        assert rr.status_code == 200, rr.text
        info["password"] = new_pw
        r2 = _login(info["email"], new_pw)
        tok = r2.json()["access_token"]
    return tok


@pytest.fixture(scope="session")
def role_tokens(created_users):
    return {r: _role_token(created_users, r) for r in ROLES_TO_CREATE}


@pytest.fixture(scope="session")
def project_id(super_token):
    r = requests.post(f"{API}/projects", headers=_hdr(super_token),
                      json={"name": f"TEST_W2_{RUN_TAG}", "project_type": "plots_land",
                            "location": "Bengaluru", "city": "Bengaluru"})
    assert r.status_code == 200, r.text
    return r.json()["project_id"]


# Assign a project scope to site_supervisor
@pytest.fixture(scope="session")
def scoped_supervisor(super_token, created_users, project_id):
    uid = created_users["site_supervisor"]["user_id"]
    r = requests.patch(f"{API}/users/{uid}", headers=_hdr(super_token),
                       json={"project_ids": [project_id]})
    assert r.status_code == 200, r.text
    return uid


def _get_unit(super_token, uid):
    """No GET /units/{uid} endpoint — fetch from list."""
    r = requests.get(f"{API}/units", headers=_hdr(super_token))
    assert r.status_code == 200, r.text
    for u in r.json():
        if u["unit_id"] == uid:
            return u
    return None


def _mk_sold_unit(super_token, sales_head_token, project_id, plot_suffix, price=500000):
    """Create a unit and confirm sale."""
    r = requests.post(f"{API}/units", headers=_hdr(super_token),
                      json={"project_id": project_id, "plot_number": f"W2-{RUN_TAG}-{plot_suffix}",
                            "price": price})
    assert r.status_code == 200, r.text
    uid = r.json()["unit_id"]
    r = requests.post(f"{API}/units/{uid}/sell", headers=_hdr(sales_head_token),
                      json={"owner_name": f"Buyer {plot_suffix}", "owner_email": f"buyer_{plot_suffix}@x.com",
                            "total_price": price})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "sale_confirmed"
    return uid


# =============================================================================
# BOOKING CANCELLATION E2E
# =============================================================================
class TestCancellationWorkflow:

    def test_request_cancellation_on_available_unit_rejected(self, super_token, project_id):
        r = requests.post(f"{API}/units", headers=_hdr(super_token),
                          json={"project_id": project_id, "plot_number": f"W2-{RUN_TAG}-AV",
                                "price": 100000})
        uid = r.json()["unit_id"]
        r = requests.post(f"{API}/units/{uid}/request-cancellation",
                          headers=_hdr(super_token), json={"reason": "test"})
        assert r.status_code == 400

    def test_zero_paid_approve_auto_refund_complete(self, super_token, role_tokens, project_id):
        uid = _mk_sold_unit(super_token, role_tokens["sales_head"], project_id, "Z1")
        r = requests.post(f"{API}/units/{uid}/request-cancellation",
                          headers=_hdr(super_token), json={"reason": "buyer changed mind"})
        assert r.status_code == 200, r.text
        cxl = r.json()
        assert cxl["status"] == "pending_sales_review"
        assert cxl["amount_paid_to_date"] == 0
        cxl_id = cxl["cancellation_id"]

        # unit flipped to cancellation_requested
        u = _get_unit(super_token, uid)
        assert u["status"] == "cancellation_requested"

        # sales_head approves
        r = requests.post(f"{API}/cancellations/{cxl_id}/sales-review",
                          headers=_hdr(role_tokens["sales_head"]),
                          json={"action": "approve", "note": ""})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "refund_completed"

        # unit -> available_for_resale
        u = _get_unit(super_token, uid)
        assert u["status"] == "available_for_resale"
        assert not u.get("owner_name")

    def test_duplicate_cancellation_rejected(self, super_token, role_tokens, project_id):
        uid = _mk_sold_unit(super_token, role_tokens["sales_head"], project_id, "DUP")
        r1 = requests.post(f"{API}/units/{uid}/request-cancellation",
                           headers=_hdr(super_token), json={"reason": "first"})
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/units/{uid}/request-cancellation",
                           headers=_hdr(super_token), json={"reason": "again"})
        assert r2.status_code == 400

    def test_paid_gt_zero_pending_refund_then_complete(self, super_token, role_tokens, project_id):
        uid = _mk_sold_unit(super_token, role_tokens["sales_head"], project_id, "PAID")
        # schedule + full payment
        r = requests.post(f"{API}/units/{uid}/installments", headers=_hdr(super_token),
                          json=[{"stage_name": "Full", "percent": 100, "amount": 500000,
                                 "due_date": "2026-03-01"}])
        assert r.status_code == 200
        inst = requests.get(f"{API}/units/{uid}/installments", headers=_hdr(super_token)).json()[0]
        iid = inst["installment_id"]
        requests.post(f"{API}/installments/{iid}/claim",
                      headers=_hdr(role_tokens["post_sales_rep"]),
                      json={"claimed_amount": 500000, "claim_reference": "TX"})
        requests.post(f"{API}/installments/{iid}/verify",
                      headers=_hdr(role_tokens["accounts_rep"]),
                      json={"reflected": True, "received_amount": 500000})
        requests.post(f"{API}/installments/{iid}/approve",
                      headers=_hdr(role_tokens["accounts_head"]),
                      json={"action": "approve"})

        # request cancellation
        r = requests.post(f"{API}/units/{uid}/request-cancellation",
                          headers=_hdr(super_token), json={"reason": "post-paid cxl"})
        assert r.status_code == 200
        cxl = r.json()
        assert cxl["amount_paid_to_date"] == 500000
        assert cxl["refund_amount"] == 500000
        cxl_id = cxl["cancellation_id"]

        # sales approve => pending_refund, unit=cancelled
        r = requests.post(f"{API}/cancellations/{cxl_id}/sales-review",
                          headers=_hdr(role_tokens["sales_head"]),
                          json={"action": "approve"})
        assert r.status_code == 200
        assert r.json()["status"] == "pending_refund"
        u = _get_unit(super_token, uid)
        assert u["status"] == "cancelled"

        # accounts_rep completes refund
        r = requests.post(f"{API}/cancellations/{cxl_id}/refund",
                          headers=_hdr(role_tokens["accounts_rep"]),
                          json={"refund_reference": "REFTX1", "refund_mode": "bank_transfer"})
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "refund_completed"
        assert body["refund_reference"] == "REFTX1"
        u = _get_unit(super_token, uid)
        assert u["status"] == "available_for_resale"

    def test_reject_rolls_unit_back(self, super_token, role_tokens, project_id):
        uid = _mk_sold_unit(super_token, role_tokens["sales_head"], project_id, "REJ")
        # capture prev status
        prev = _get_unit(super_token, uid)["status"]
        r = requests.post(f"{API}/units/{uid}/request-cancellation",
                          headers=_hdr(super_token), json={"reason": "will be rejected"})
        cxl_id = r.json()["cancellation_id"]
        r = requests.post(f"{API}/cancellations/{cxl_id}/sales-review",
                          headers=_hdr(role_tokens["sales_head"]),
                          json={"action": "reject", "note": "docs incomplete"})
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"
        u = _get_unit(super_token, uid)
        assert u["status"] == prev

    # ----- RBAC -----
    def test_sales_rep_cannot_sales_review(self, super_token, role_tokens, project_id):
        uid = _mk_sold_unit(super_token, role_tokens["sales_head"], project_id, "RBAC1")
        r = requests.post(f"{API}/units/{uid}/request-cancellation",
                          headers=_hdr(super_token), json={"reason": "x"})
        cxl_id = r.json()["cancellation_id"]
        r = requests.post(f"{API}/cancellations/{cxl_id}/sales-review",
                          headers=_hdr(role_tokens["sales_rep"]),
                          json={"action": "approve"})
        assert r.status_code == 403

    def test_crm_head_cannot_record_refund(self, super_token, role_tokens, project_id):
        uid = _mk_sold_unit(super_token, role_tokens["sales_head"], project_id, "RBAC2")
        # make it pending_refund by paying 1 rupee via schedule/claim/verify/approve, cheaper: use paid flow above shortcut
        # Simpler: create manual payment via mongo? no. Use full mini flow.
        r = requests.post(f"{API}/units/{uid}/installments", headers=_hdr(super_token),
                          json=[{"stage_name": "S", "percent": 100, "amount": 500000, "due_date": "2026-03-01"}])
        inst = requests.get(f"{API}/units/{uid}/installments", headers=_hdr(super_token)).json()[0]
        iid = inst["installment_id"]
        requests.post(f"{API}/installments/{iid}/claim", headers=_hdr(role_tokens["post_sales_rep"]),
                      json={"claimed_amount": 500000})
        requests.post(f"{API}/installments/{iid}/verify", headers=_hdr(role_tokens["accounts_rep"]),
                      json={"reflected": True, "received_amount": 500000})
        requests.post(f"{API}/installments/{iid}/approve", headers=_hdr(role_tokens["accounts_head"]),
                      json={"action": "approve"})
        rr = requests.post(f"{API}/units/{uid}/request-cancellation",
                           headers=_hdr(super_token), json={"reason": "rbac"})
        cxl_id = rr.json()["cancellation_id"]
        requests.post(f"{API}/cancellations/{cxl_id}/sales-review",
                      headers=_hdr(role_tokens["sales_head"]),
                      json={"action": "approve"})
        r = requests.post(f"{API}/cancellations/{cxl_id}/refund",
                          headers=_hdr(role_tokens["crm_head"]),
                          json={"refund_reference": "X", "refund_mode": "cash"})
        assert r.status_code == 403


# =============================================================================
# MATERIAL REQUEST E2E
# =============================================================================
class TestMaterialRequests:

    def _create(self, token, project_id, subject_suffix="A", items=None):
        payload = {
            "project_id": project_id,
            "subject": f"MR-{RUN_TAG}-{subject_suffix}",
            "priority": "high",
            "justification": "site needs",
            "items": items if items is not None else [
                {"name": "Cement", "quantity": 100, "unit": "bag"},
                {"name": "Steel", "quantity": 50, "unit": "kg"},
            ],
        }
        return requests.post(f"{API}/material-requests", headers=_hdr(token), json=payload)

    def test_create_by_site_supervisor(self, role_tokens, project_id, scoped_supervisor):
        r = self._create(role_tokens["site_supervisor"], project_id, "SS")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "pending_crm_review"
        assert body["subject"].startswith("MR-")
        assert len(body["items"]) == 2

    def test_empty_items_rejected(self, role_tokens, project_id, scoped_supervisor):
        r = self._create(role_tokens["site_supervisor"], project_id, "EMPTY", items=[])
        assert r.status_code == 400

    def test_full_chain_approve(self, role_tokens, super_token, project_id, scoped_supervisor):
        r = self._create(role_tokens["site_supervisor"], project_id, "CHAIN")
        rid = r.json()["request_id"]
        # CRM review approve
        r = requests.post(f"{API}/material-requests/{rid}/crm-review",
                          headers=_hdr(role_tokens["crm_head"]),
                          json={"action": "approve", "note": "ok"})
        assert r.status_code == 200
        assert r.json()["status"] == "pending_admin_review"
        # Admin review approve
        r = requests.post(f"{API}/material-requests/{rid}/admin-review",
                          headers=_hdr(role_tokens["process_admin"]),
                          json={"action": "approve", "note": "ok"})
        assert r.status_code == 200
        assert r.json()["status"] == "pending_super_admin"
        # Final approve by super_admin
        r = requests.post(f"{API}/material-requests/{rid}/final",
                          headers=_hdr(super_token),
                          json={"action": "approve", "note": "final"})
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

    def test_reject_at_crm(self, role_tokens, project_id, scoped_supervisor):
        r = self._create(role_tokens["site_supervisor"], project_id, "RJCRM")
        rid = r.json()["request_id"]
        r = requests.post(f"{API}/material-requests/{rid}/crm-review",
                          headers=_hdr(role_tokens["crm_head"]),
                          json={"action": "reject", "note": "not needed"})
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"

    def test_return_at_crm_no_advance(self, role_tokens, project_id, scoped_supervisor):
        r = self._create(role_tokens["site_supervisor"], project_id, "RETCRM")
        rid = r.json()["request_id"]
        r = requests.post(f"{API}/material-requests/{rid}/crm-review",
                          headers=_hdr(role_tokens["crm_head"]),
                          json={"action": "return", "note": "clarify qty"})
        assert r.status_code == 200
        # status should remain pending_crm_review (not advanced)
        assert r.json()["status"] == "pending_crm_review"

    def test_return_at_admin_sends_back_to_crm(self, role_tokens, project_id, scoped_supervisor):
        r = self._create(role_tokens["site_supervisor"], project_id, "RETADM")
        rid = r.json()["request_id"]
        requests.post(f"{API}/material-requests/{rid}/crm-review",
                      headers=_hdr(role_tokens["crm_head"]),
                      json={"action": "approve"})
        r = requests.post(f"{API}/material-requests/{rid}/admin-review",
                         headers=_hdr(role_tokens["process_admin"]),
                         json={"action": "return", "note": "recheck"})
        assert r.status_code == 200
        assert r.json()["status"] == "pending_crm_review"

    # ----- RBAC -----
    def test_crm_head_cannot_final(self, role_tokens, project_id, scoped_supervisor):
        r = self._create(role_tokens["site_supervisor"], project_id, "RBACF")
        rid = r.json()["request_id"]
        requests.post(f"{API}/material-requests/{rid}/crm-review",
                      headers=_hdr(role_tokens["crm_head"]), json={"action": "approve"})
        requests.post(f"{API}/material-requests/{rid}/admin-review",
                      headers=_hdr(role_tokens["process_admin"]), json={"action": "approve"})
        r = requests.post(f"{API}/material-requests/{rid}/final",
                          headers=_hdr(role_tokens["crm_head"]),
                          json={"action": "approve"})
        assert r.status_code == 403

    def test_sales_rep_cannot_create(self, role_tokens, project_id):
        r = self._create(role_tokens["sales_rep"], project_id, "SRBLK")
        assert r.status_code == 403


# =============================================================================
# REMINDER ENGINE / CRON
# =============================================================================
class TestReminderCron:
    def test_no_auth_401(self):
        r = requests.post(f"{API}/cron/reminders")
        assert r.status_code == 401

    def test_wrong_bearer_401(self):
        r = requests.post(f"{API}/cron/reminders",
                          headers={"Authorization": "Bearer WRONG"})
        assert r.status_code == 401

    def test_correct_bearer_200(self):
        assert CRON_SECRET, "WEBHOOK_CRON_SECRET not readable"
        r = requests.post(f"{API}/cron/reminders",
                          headers={"Authorization": f"Bearer {CRON_SECRET}"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("accepted") is True
        assert "run_id" in j

    def test_run_now_super_admin(self, super_token):
        r = requests.post(f"{API}/cron/reminders/run-now", headers=_hdr(super_token))
        assert r.status_code == 200, r.text
        j = r.json()
        assert "scanned" in j and "reminders_sent" in j and "run_at" in j

    def test_run_now_non_super_admin_forbidden(self, role_tokens):
        r = requests.post(f"{API}/cron/reminders/run-now",
                          headers=_hdr(role_tokens["accounts_head"]))
        assert r.status_code == 403


class TestReminderIdempotencyAndFire:
    """
    Backdate an installment's due_date so that today - due == 0 (T-day) and
    verify:
    - run_now sends >=1 reminder
    - a notification is created in db.notifications
    - a second run does NOT double-fire (reminder_log dedup)
    """

    def test_fires_and_is_idempotent(self, super_token, role_tokens, project_id):
        # Create sold unit + schedule with due_date=today
        uid = _mk_sold_unit(super_token, role_tokens["sales_head"], project_id, "REM")
        today = datetime.date.today().isoformat()
        r = requests.post(f"{API}/units/{uid}/installments", headers=_hdr(super_token),
                          json=[{"stage_name": "Rem", "percent": 100,
                                 "amount": 500000, "due_date": today}])
        assert r.status_code == 200, r.text

        # First run
        r1 = requests.post(f"{API}/cron/reminders/run-now", headers=_hdr(super_token))
        assert r1.status_code == 200
        sent1 = r1.json()["reminders_sent"]

        # Second run: should not re-fire for same (installment, offset)
        r2 = requests.post(f"{API}/cron/reminders/run-now", headers=_hdr(super_token))
        assert r2.status_code == 200
        sent2 = r2.json()["reminders_sent"]

        assert sent1 >= 1, f"Expected at least one reminder sent, got {sent1}"
        # Idempotency: second run must send fewer (dedupe respected)
        assert sent2 < sent1, f"Idempotency violated: sent1={sent1} sent2={sent2}"

        # Fetch notifications as post_sales_rep (fewer notifications there)
        rn = requests.get(f"{API}/notifications",
                          headers=_hdr(role_tokens["post_sales_rep"]))
        assert rn.status_code == 200, rn.text
        notes = rn.json()
        reminder_notes = [n for n in notes if n.get("kind") == "payment_reminder"]
        assert len(reminder_notes) >= 1, (
            f"No payment_reminder notification created (post_sales_rep has {len(notes)} notes total)")


# =============================================================================
# HEALTH / REGRESSION
# =============================================================================
class TestHealth:
    def test_api_health(self):
        r = requests.get(f"{API}/health")
        assert r.status_code == 200

    def test_root_health(self):
        r = requests.get(f"{BASE_URL}/health")
        assert r.status_code == 200


class TestCronsYml:
    def test_crons_yml_exists_and_valid(self):
        import yaml
        with open("/app/.emergent/crons.yml") as f:
            data = yaml.safe_load(f)
        assert "crons" in data
        assert any(c.get("endpoint", "").endswith("/api/cron/reminders")
                   for c in data["crons"])
