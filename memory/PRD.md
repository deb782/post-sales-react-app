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

## Backlog (Waves 2–4)
### P0
- Reminder engine via `.emergent/crons.yml` (T-2, T-day, T+1/3/7)
- Booking cancellation + refund workflow
- Site material request chain: Site Supervisor → CRM Head → Process Admin → Super Admin

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
- Server.py modularization (~2800 lines) into feature routers

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
- iter13 (Wave 1): `/app/test_reports/iteration_13.json` — **20/20 backend + full frontend smoke PASS**
- Previous: iter9 (v2 baseline), iter10 (users mgmt), iter11 (lockout), iter12 (self-heal seed)
