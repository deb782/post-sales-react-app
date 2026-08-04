"""
Iter13 — Wave 1 Backend Regression
Covers: 9-role model, 2-step sale approval, 3-step payment verification,
promise-to-pay, 14-status units, onboarding status, RBAC guards.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL}/api"

SUPER_EMAIL = "deb@agrocorp.co.in"
SUPER_TEMP = "Admin@Agro@2026#"
SUPER_NEW = "Agrocorp@2026#"

ROLES_TO_CREATE = [
    "process_admin", "crm_head", "sales_head", "accounts_head",
    "sales_rep", "post_sales_rep", "accounts_rep", "site_supervisor",
]

RUN_TAG = uuid.uuid4().hex[:6]


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    return r


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


# ------------------------------------------------------------------ session
@pytest.fixture(scope="session")
def super_token():
    """Login as super_admin. Handle both must_reset (first boot) and normal path."""
    # Try current password
    r = _login(SUPER_EMAIL, SUPER_TEMP)
    if r.status_code == 200:
        data = r.json()
        token = data["access_token"]
        if data.get("must_reset_password"):
            # Change to new stronger password
            rr = requests.post(f"{API}/auth/change-password",
                               headers=_hdr(token),
                               json={"current_password": SUPER_TEMP,
                                     "new_password": SUPER_NEW})
            # Even if it fails ("must differ"), keep going
            if rr.status_code == 200:
                # re-login with new password so token reflects must_reset=false
                r2 = _login(SUPER_EMAIL, SUPER_NEW)
                if r2.status_code == 200:
                    return r2.json()["access_token"]
        return token
    # Maybe already changed
    r = _login(SUPER_EMAIL, SUPER_NEW)
    if r.status_code == 200:
        return r.json()["access_token"]
    pytest.skip(f"Super admin login failed: {r.status_code} {r.text}")


@pytest.fixture(scope="session")
def created_users(super_token):
    """Create one user per role via /api/users. Returns dict role -> (user_id, email, temp_password)."""
    out = {}
    for role in ROLES_TO_CREATE:
        email = f"test_{role}_{RUN_TAG}@example.com"
        r = requests.post(f"{API}/users", headers=_hdr(super_token),
                          json={"email": email, "name": f"Test {role}", "role": role})
        assert r.status_code == 200, f"create {role}: {r.status_code} {r.text}"
        j = r.json()
        out[role] = {"user_id": j["user"]["user_id"], "email": email,
                     "temp_password": j["temp_password"]}
    return out


def _role_token(created_users, role, new_password=None):
    """Login as role user, change password if forced."""
    info = created_users[role]
    pw = new_password or info.get("password") or info["temp_password"]
    r = _login(info["email"], pw)
    if r.status_code != 200:
        pytest.fail(f"Login for {role} failed: {r.status_code} {r.text}")
    j = r.json()
    tok = j["access_token"]
    if j.get("must_reset_password") and not new_password:
        new_pw = f"Test@Role@{RUN_TAG}#1"
        rr = requests.post(f"{API}/auth/change-password", headers=_hdr(tok),
                           json={"current_password": info["temp_password"],
                                 "new_password": new_pw})
        assert rr.status_code == 200, rr.text
        info["password"] = new_pw
        # re-login
        r2 = _login(info["email"], new_pw)
        tok = r2.json()["access_token"]
    return tok


@pytest.fixture(scope="session")
def role_tokens(created_users):
    tokens = {}
    for role in ROLES_TO_CREATE:
        tokens[role] = _role_token(created_users, role)
    return tokens


@pytest.fixture(scope="session")
def project_id(super_token):
    r = requests.post(f"{API}/projects", headers=_hdr(super_token),
                      json={"name": f"TEST_Proj_{RUN_TAG}", "project_type": "plots_land",
                            "location": "Bengaluru", "city": "Bengaluru"})
    assert r.status_code == 200, r.text
    return r.json()["project_id"]


# ------------------------------------------------------------------ tests
class TestAuthAndRoles:
    def test_super_admin_login(self):
        # Try both possible passwords
        r = _login(SUPER_EMAIL, SUPER_TEMP)
        if r.status_code != 200:
            r = _login(SUPER_EMAIL, SUPER_NEW)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "access_token" in j
        assert j["user"]["role"] == "super_admin"
        assert j["user"]["email"] == SUPER_EMAIL

    def test_create_all_9_roles(self, created_users):
        # created_users fixture already creates 8 non-admin roles; super_admin is seeded.
        assert len(created_users) == 8
        for role in ROLES_TO_CREATE:
            assert created_users[role]["user_id"].startswith("user_")

    def test_list_users_returns_created(self, super_token, created_users):
        r = requests.get(f"{API}/users", headers=_hdr(super_token))
        assert r.status_code == 200
        users = r.json()
        emails = {u["email"] for u in users}
        for role, info in created_users.items():
            assert info["email"] in emails
        # role labels present in users
        roles_found = {u["role"] for u in users}
        assert "super_admin" in roles_found
        for r_ in ROLES_TO_CREATE:
            assert r_ in roles_found


class TestSaleApprovalTwoStep:
    def test_sales_rep_booking_pending(self, super_token, role_tokens, project_id):
        # Create a unit as super_admin
        r = requests.post(f"{API}/units", headers=_hdr(super_token),
                          json={"project_id": project_id, "plot_number": f"P-{RUN_TAG}-1",
                                "price": 500000})
        assert r.status_code == 200, r.text
        uid = r.json()["unit_id"]
        # sales_rep sells
        r = requests.post(f"{API}/units/{uid}/sell",
                          headers=_hdr(role_tokens["sales_rep"]),
                          json={"owner_name": "Buyer A", "owner_contact": "9999999999",
                                "total_price": 500000})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "booked_pending_sales_approval"

        # sales_head approves
        r = requests.post(f"{API}/units/{uid}/sales-review",
                          headers=_hdr(role_tokens["sales_head"]),
                          json={"action": "approve", "note": "ok"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "sale_confirmed"

    def test_sales_head_self_approve(self, super_token, role_tokens, project_id):
        r = requests.post(f"{API}/units", headers=_hdr(super_token),
                          json={"project_id": project_id, "plot_number": f"P-{RUN_TAG}-2",
                                "price": 300000})
        uid = r.json()["unit_id"]
        r = requests.post(f"{API}/units/{uid}/sell",
                          headers=_hdr(role_tokens["sales_head"]),
                          json={"owner_name": "Buyer B", "total_price": 300000})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "sale_confirmed"

    def test_sale_reject_clears_owner(self, super_token, role_tokens, project_id):
        r = requests.post(f"{API}/units", headers=_hdr(super_token),
                          json={"project_id": project_id, "plot_number": f"P-{RUN_TAG}-3",
                                "price": 400000})
        uid = r.json()["unit_id"]
        requests.post(f"{API}/units/{uid}/sell",
                      headers=_hdr(role_tokens["sales_rep"]),
                      json={"owner_name": "Buyer C", "total_price": 400000})
        r = requests.post(f"{API}/units/{uid}/sales-review",
                         headers=_hdr(role_tokens["sales_head"]),
                         json={"action": "reject", "note": "invalid docs"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "available"
        assert body.get("owner_name") in (None, "")
        assert body.get("total_price", 0) == 0

    def test_sales_rep_cannot_review(self, role_tokens, super_token, project_id):
        # create unit + pending sale
        r = requests.post(f"{API}/units", headers=_hdr(super_token),
                          json={"project_id": project_id, "plot_number": f"P-{RUN_TAG}-4",
                                "price": 100000})
        uid = r.json()["unit_id"]
        requests.post(f"{API}/units/{uid}/sell",
                      headers=_hdr(role_tokens["sales_rep"]),
                      json={"owner_name": "Buyer D", "total_price": 100000})
        r = requests.post(f"{API}/units/{uid}/sales-review",
                          headers=_hdr(role_tokens["sales_rep"]),
                          json={"action": "approve"})
        assert r.status_code == 403


class TestPaymentThreeStep:
    @pytest.fixture(scope="class")
    def sold_unit(self, super_token, role_tokens, project_id):
        r = requests.post(f"{API}/units", headers=_hdr(super_token),
                          json={"project_id": project_id, "plot_number": f"P-{RUN_TAG}-PAY",
                                "price": 100000})
        uid = r.json()["unit_id"]
        r = requests.post(f"{API}/units/{uid}/sell",
                          headers=_hdr(role_tokens["sales_head"]),
                          json={"owner_name": "Pay Buyer", "total_price": 100000})
        assert r.json()["status"] == "sale_confirmed"
        return uid

    def _mk_schedule(self, super_token, unit_id, amount=100000):
        r = requests.post(f"{API}/units/{unit_id}/installments",
                          headers=_hdr(super_token),
                          json=[{"stage_name": "Full", "percent": 100,
                                 "amount": amount, "due_date": "2026-03-01"}])
        assert r.status_code == 200, r.text
        r2 = requests.get(f"{API}/units/{unit_id}/installments",
                          headers=_hdr(super_token))
        return r2.json()[0]["installment_id"]

    def test_full_flow_claim_verify_approve_paid(self, super_token, role_tokens, sold_unit):
        inst_id = self._mk_schedule(super_token, sold_unit, 100000)
        # claim by post_sales_rep
        r = requests.post(f"{API}/installments/{inst_id}/claim",
                          headers=_hdr(role_tokens["post_sales_rep"]),
                          json={"claimed_amount": 100000, "claim_reference": "TXN123"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "payment_claimed"

        # verify by accounts_rep (reflected)
        r = requests.post(f"{API}/installments/{inst_id}/verify",
                          headers=_hdr(role_tokens["accounts_rep"]),
                          json={"reflected": True, "received_amount": 100000})
        assert r.status_code == 200
        assert r.json()["status"] == "pending_head_approval"

        # approve by accounts_head
        r = requests.post(f"{API}/installments/{inst_id}/approve",
                          headers=_hdr(role_tokens["accounts_head"]),
                          json={"action": "approve"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "paid"

        # unit should be fully_paid
        u = requests.get(f"{API}/units?project_id=", headers=_hdr(super_token)).json()
        unit = next((x for x in u if x["unit_id"] == sold_unit), None)
        assert unit is not None
        assert unit["status"] == "fully_paid"

        # payment record exists
        pays = requests.get(f"{API}/payments", headers=_hdr(super_token)).json()
        assert any(p["unit_id"] == sold_unit and p["amount"] == 100000 for p in pays)

    def test_verify_not_reflected(self, super_token, role_tokens, project_id):
        r = requests.post(f"{API}/units", headers=_hdr(super_token),
                          json={"project_id": project_id, "plot_number": f"P-{RUN_TAG}-NR",
                                "price": 50000})
        uid = r.json()["unit_id"]
        requests.post(f"{API}/units/{uid}/sell",
                      headers=_hdr(role_tokens["sales_head"]),
                      json={"owner_name": "NR", "total_price": 50000})
        inst_id = self._mk_schedule(super_token, uid, 50000)
        requests.post(f"{API}/installments/{inst_id}/claim",
                      headers=_hdr(role_tokens["post_sales_rep"]),
                      json={"claimed_amount": 50000})
        r = requests.post(f"{API}/installments/{inst_id}/verify",
                          headers=_hdr(role_tokens["accounts_rep"]),
                          json={"reflected": False})
        assert r.status_code == 200
        assert r.json()["status"] == "not_reflected"

    def test_partial_payment(self, super_token, role_tokens, project_id):
        r = requests.post(f"{API}/units", headers=_hdr(super_token),
                          json={"project_id": project_id, "plot_number": f"P-{RUN_TAG}-PART",
                                "price": 100000})
        uid = r.json()["unit_id"]
        requests.post(f"{API}/units/{uid}/sell",
                      headers=_hdr(role_tokens["sales_head"]),
                      json={"owner_name": "Part", "total_price": 100000})
        inst_id = self._mk_schedule(super_token, uid, 100000)
        requests.post(f"{API}/installments/{inst_id}/claim",
                      headers=_hdr(role_tokens["post_sales_rep"]),
                      json={"claimed_amount": 100000})
        requests.post(f"{API}/installments/{inst_id}/verify",
                      headers=_hdr(role_tokens["accounts_rep"]),
                      json={"reflected": True, "received_amount": 40000})
        r = requests.post(f"{API}/installments/{inst_id}/approve",
                          headers=_hdr(role_tokens["accounts_head"]),
                          json={"action": "approve"})
        assert r.status_code == 200
        assert r.json()["status"] == "partial"

    def test_promise_to_pay(self, super_token, role_tokens, project_id):
        r = requests.post(f"{API}/units", headers=_hdr(super_token),
                          json={"project_id": project_id, "plot_number": f"P-{RUN_TAG}-P2P",
                                "price": 50000})
        uid = r.json()["unit_id"]
        requests.post(f"{API}/units/{uid}/sell",
                      headers=_hdr(role_tokens["sales_head"]),
                      json={"owner_name": "P2P", "total_price": 50000})
        inst_id = self._mk_schedule(super_token, uid, 50000)
        # capture original due date
        before = requests.get(f"{API}/units/{uid}/installments",
                              headers=_hdr(super_token)).json()[0]
        orig_due = before["due_date"]
        r = requests.post(f"{API}/installments/{inst_id}/promise-to-pay",
                          headers=_hdr(role_tokens["post_sales_rep"]),
                          json={"promise_amount": 50000,
                                "promise_date": "2026-04-15",
                                "notes": "customer travelling"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "promise_to_pay"
        assert body["promise_date"] == "2026-04-15"
        assert body["due_date"] == orig_due  # unchanged

    def test_accounts_rep_cannot_approve(self, super_token, role_tokens, project_id):
        r = requests.post(f"{API}/units", headers=_hdr(super_token),
                          json={"project_id": project_id, "plot_number": f"P-{RUN_TAG}-RBAC",
                                "price": 10000})
        uid = r.json()["unit_id"]
        requests.post(f"{API}/units/{uid}/sell",
                      headers=_hdr(role_tokens["sales_head"]),
                      json={"owner_name": "RB", "total_price": 10000})
        inst_id = self._mk_schedule(super_token, uid, 10000)
        requests.post(f"{API}/installments/{inst_id}/claim",
                      headers=_hdr(role_tokens["post_sales_rep"]),
                      json={"claimed_amount": 10000})
        requests.post(f"{API}/installments/{inst_id}/verify",
                      headers=_hdr(role_tokens["accounts_rep"]),
                      json={"reflected": True, "received_amount": 10000})
        r = requests.post(f"{API}/installments/{inst_id}/approve",
                          headers=_hdr(role_tokens["accounts_rep"]),
                          json={"action": "approve"})
        assert r.status_code == 403


class TestRBACUsers:
    def test_process_admin_cannot_create_super_admin(self, role_tokens):
        r = requests.post(f"{API}/users",
                          headers=_hdr(role_tokens["process_admin"]),
                          json={"email": f"boom_{RUN_TAG}@example.com",
                                "name": "Boom", "role": "super_admin"})
        assert r.status_code == 403

    def test_process_admin_cannot_delete_super_admin(self, role_tokens, super_token):
        # find super_admin user_id via /auth/me
        me = requests.get(f"{API}/auth/me", headers=_hdr(super_token)).json()
        r = requests.delete(f"{API}/users/{me['user_id']}",
                            headers=_hdr(role_tokens["process_admin"]))
        assert r.status_code == 403

    def test_process_admin_cannot_promote_to_super_admin(self, role_tokens, created_users):
        target = created_users["sales_rep"]["user_id"]
        r = requests.patch(f"{API}/users/{target}",
                          headers=_hdr(role_tokens["process_admin"]),
                          json={"role": "super_admin"})
        assert r.status_code == 403


class TestOnboarding:
    def test_status_returns_7_steps_and_counts(self, super_token):
        r = requests.get(f"{API}/onboarding/status", headers=_hdr(super_token))
        assert r.status_code == 200
        j = r.json()
        assert j["total_steps"] == 7
        assert len(j["steps"]) == 7
        counts = j["counts"]
        for k in ("accounts", "management", "sales", "crm", "site_supervisor"):
            assert k in counts, f"missing counts key: {k}"
            assert isinstance(counts[k], int)


class TestUnitStatusLiteral:
    def test_all_15_statuses_in_source(self):
        # Wave 2 added 'cancellation_requested' → 15 statuses total.
        import server  # noqa
        expected = {"available", "on_hold", "temporarily_blocked", "booking_in_progress",
                    "booked_pending_sales_approval", "sale_confirmed", "post_sales_active",
                    "fully_paid", "registration_pending", "registered",
                    "possession_pending", "possession_completed",
                    "cancellation_requested", "cancelled",
                    "available_for_resale"}
        actual = set(server.UnitStatus.__args__)
        assert expected == actual


# ------------------------------------------------------------------ regression from iter11
class TestRegressionAuth:
    def test_forgot_password_public(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": "nonexistent@example.com"})
        # Always success (per spec, prevents email enumeration)
        assert r.status_code == 200

    def test_me_profile_get(self, super_token):
        r = requests.get(f"{API}/auth/me", headers=_hdr(super_token))
        assert r.status_code == 200
        assert r.json()["email"] == SUPER_EMAIL

    def test_login_lockout_after_5_fails(self):
        bad_email = f"lockout_{RUN_TAG}@example.com"
        # 5 bad attempts on a non-existent email (also triggers lock counter)
        for i in range(5):
            requests.post(f"{API}/auth/login",
                          json={"email": bad_email, "password": "wrong"})
        r = requests.post(f"{API}/auth/login",
                         json={"email": bad_email, "password": "wrong"})
        assert r.status_code == 429, f"Expected 429 lockout, got {r.status_code}: {r.text}"
