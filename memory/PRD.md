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

## Wave 3 kickoff — Cost-sheet accurate pricing + plans (Feb 2026)
- **Unit.pricing** structured block: `bsp`, `plc` (+breakdown), `oc1`, `oc2` (+breakdown for legal/club/maintenance), `ifms`, `gst_rate`, `grand_total`. OC1 = Infrastructure & Development (pre-tax). OC2 = Legal + Club + 2-year Maintenance (pre-tax bundle). IFMS = refundable, non-GST. GST is applied at the payment-plan stage, not baked in.
- **PlanStage** extended with `bsp_percent`, `plc_percent`, `oc1_percent`, `oc2_percent`, `apply_gst`, `charge_ifms`, and a `trigger` enum (`booking` | `days_from_booking` | `notice_of_possession`). Legacy `percent` still honoured so pre-existing plans keep working.
- **`compute_stage_amount()`** helper returns per-stage total + itemized breakdown (bsp / plc / oc1 / gst_oc1 / oc2 / gst_oc2 / ifms).
- **`POST /api/units/{id}/auto-schedule`** generates all installments from a unit's pricing × its linked plan (booking_date optional; defaults to `sold_at`). Deferred stages tied to Notice of Possession are inserted with `deferred_until_nop=true`.
- **`POST /api/units/vv-import`**: Excel/CSV importer specifically for Vacation Village cost-sheet columns (UNIT NO, EXTENT, Basic Sale Price, East/Hill/Corner PLC, Infra & Dev, Legal, Club, Maintenance, IFMS, Grand Total). Loads formula-computed values (`data_only=True`). Upserts on `(project_id, plot_number)`; skips units that are already sold/booked.
- **`POST /api/setup/vv-payment-plans`**: idempotent seed for the 4 canonical plans:
  - **VV - 50/50 Payment Plan** — 10 % booking · 40 % + OC1 at agreement · 50 % + OC2 + IFMS at NoP
  - **VV - 70/30 Payment Plan (August Offer)** — 10/20/70 with OC1 at agreement, OC2 + IFMS at NoP
  - **VV - Down Payment Plan** — 10/80 upfront · 100 % PLC + OC1 at 120d · 10 % + OC2 + IFMS at NoP
  - **VV - Time Linked** — 8 stages across booking → 300 d + NoP; OC1 & OC2 each split 50/50 across two milestones
- Verified in preview against 256 units of Vacation Village CKM — every plan reconciles to grand_total to the rupee.

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
