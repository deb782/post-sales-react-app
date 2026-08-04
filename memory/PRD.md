# Agrocorp Admin — PRD (v3)

## Original problem
Real-estate post-sales and site-operations management system: booking lifecycle, payment tracking, customer follow-ups, site inventory, role-based approvals.

## Role hierarchy (v3 — 9 roles, 2-tier)
- **Level 1**: super_admin, process_admin
- **Level 2 (Heads)**: crm_head, sales_head, accounts_head
- **Level 3 (Reps)**: sales_rep, post_sales_rep, accounts_rep
- **Level 4**: site_supervisor (per-project)

Core rule: Process Admin prepares, Super Admin approves. No one approves their own submissions.

## Wave 1 (delivered Feb 2026, iter13 20/20 PASS)
- 9-role hierarchy + RBAC
- **Sale approval 2-step**: Sales Rep drafts → `booked_pending_sales_approval` → Sales Head reviews → `sale_confirmed`
- **Payment verification 3-step**: Post-Sales `claim` → Accounts Rep `verify` → Accounts Head `approve`
- **Promise-to-Pay** on installments (original due date preserved)
- **14 plot statuses** (available → possession_completed → available_for_resale)
- **13 installment statuses** including partial, waived, rescheduled
- **/sales-approvals page** — Sales Head approval queue with approve/reject/return + note
- DB wiped and reseeded with deb@agrocorp.co.in as Super Admin

## Wave 2 (delivered Feb 2026, iter14 24/24 PASS)
- **Booking cancellation + refund workflow** (`/cancellations` page): Sales rep/CRM raises → Sales Head reviews → Accounts records refund (plain refund = amount paid, no deductions) → unit auto-flips to `available_for_resale`
- **Site material request chain** (`/material-requests` page): Site Supervisor / CRM Head → CRM Head review → Process Admin review → Super Admin approves; stock is logged manually, NOT auto-decremented
- **Reminder engine** — `.emergent/crons.yml` triggers `POST /api/cron/reminders` daily 08:00 IST; fires at T-2, T-day, T+1, T+3, T+7 to team (in-app + email) and customer (email at T-2/T-day/T+3/T+7); idempotent via `reminder_log` collection
- **New status**: `cancellation_requested` → **15 plot statuses**
- **Cancel button** added to sold units in Sales page
- Sidebar entries: **Cancellations**, **Material Requests**
- `WEBHOOK_CRON_SECRET` in `backend/.env`

## Hotfix — Legacy role auto-migration (Feb 2026, post-Wave 2 prod deploy)
- Bug: production users seeded before Wave 1 have legacy `role` values (`admin`, `management`, etc.). Post Wave 1/2 the `Role` Literal became strict → `get_current_user` raised Pydantic `ValidationError` → 500 on every authenticated endpoint (including `/auth/change-password`).
- Fix in `get_current_user`: if `role` is not in the current Literal, transparently map via `_LEGACY_ROLE_MAP` (admin→super_admin, management→process_admin, sales→sales_rep, accounts→accounts_rep, post_sales→post_sales_rep, crm→crm_head, supervisor→site_supervisor), persist the new role, and record the old value under `legacy_role_before_migration`.
- Unknown roles fall back to `site_supervisor` with a warning log.
- **Redeploy required** to publish this hotfix to prod.

## Backlog (Waves 3–4)
### P1
- Customer document vault (KYC, agreements, receipts)
- Reports pack (aging, collection, outstanding, sales performance)
- Escalation SLAs with auto-notify
- Discount object + audit-tracked commercial changes
- Charges split (dev, maintenance, registration, tax, legal)

### P2
- Bank reconciliation (statement import + auto-match)
- Customer communication timeline (calls, emails, WhatsApp, meetings)
- Full site procurement flow (quotation → PO → payment → receipt)
- 2FA on Profile page
- server.py modularization (now ~3350 lines) into feature routers
- WhatsApp reminder channel (Twilio) — additive to current email + in-app

## Env config
`backend/.env`:
```
ADMIN_EMAIL=deb@agrocorp.co.in
ADMIN_TEMP_PASSWORD=Admin@Agro@2026#
```
Code defaults match. Kubernetes-safe.

## Deployment
- Preview: https://property-ops-60.preview.emergentagent.com
- Production: https://property-ops-60.emergent.host (redeploy needed to publish Wave 1)

## Testing baseline
- iter14 (Wave 2): `/app/test_reports/iteration_14.json` — **24/24 backend + 5/5 frontend smoke PASS**
- iter13 (Wave 1): `/app/test_reports/iteration_13.json` — **20/20 backend + full frontend smoke PASS**
- Previous: iter9 (v2 baseline), iter10 (users mgmt), iter11 (lockout), iter12 (self-heal seed)
