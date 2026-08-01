# Agrocorp Admin — PRD

## Original problem statement
A web-based internal dashboard for a real estate company to manage
multiple projects (inventory, revenue, expenses, stock).

## Personas & roles (v2 — 6 roles)
Hierarchy: **Admin → Management → Accounts → Sales → CRM → Site Manager**

| Role | Scope | Responsibilities |
|---|---|---|
| Admin | Global | Full setup, user invites, delete projects |
| Management | Global | Setup + admin-level access minus user deletes |
| Accounts | Global | Confirm payments reflected, expense approvals |
| Sales | Global | Book plots, capture buyer + total price + template |
| CRM | Global | Build/edit payment schedule, mark initiated |
| Site Manager | Per-project | Site expenses, stock book, raise tickets |

## Product surface
- **Branding**: "Agrocorp Admin" · logo seeded from client asset.
- **First-login (admin)**: Password reset → Onboarding wizard "Build your team" (invite Mgmt+Accounts+Sales+CRM) → Fork to "Add project" or "Skip to dashboard".
- **Dashboard**: KPI totals · 7-step setup tracker · Revenue overview card with project dropdown · Per-project status strip · Inventory & expense charts · Ticket count tile.
- **Projects**: Only 2 types (Residential, Plots/Land). Simplified form (no target_revenue, no description). Inline site-manager assignment (existing or invite new). Rich cards showing PM, units, receipts, tickets.
- **Inventory / Units**: Fields `plot_number, size, facing, price, plcs[{label,amount}]`. Bulk .xlsx/.csv import with 4-column template.
- **Payment plan templates** (Settings): Admin CRUD; stages `{name, percent, days_from_start}`, must sum to 100%.
- **Sales workflow**: `/sales` page — Sales books plot → `crm_pending`, notifies Admin/Accounts/CRM (email + in-app).
- **CRM workflow**: `/crm/{unit_id}` — apply template → schedule installments → mark "initiated" → status `accounts_tracking`.
- **Accounts confirmation**: Accounts clicks "Confirm received" per installment → status `reflected`, creates payment record.
- **Tickets**: `/tickets` — Site Manager raises inventory disputes → Admin/Management resolve.

## Data model deltas from v1
- Roles: added `sales`, `crm`.
- `Project`: dropped `target_revenue`, `description`; added `site_manager_id`; types restricted to residential + plots_land.
- `Unit`: replaced `unit_type_id/unit_number/attributes/reserved_*` with `plot_number/size/facing/plcs/total_price/owner_*/discount/payment_plan_template_id/schedule_*` and pipeline status enum.
- Dropped collection: `unit_types`.
- New collections: `payment_templates`, `installments`, `tickets`.

## Testing status (Feb 2026)
- Backend regression suite: `/app/backend/tests/backend_test_iter9.py` — **22/22 PASS**.
- Frontend: onboarding → skip → dashboard verified. Sales role RBAC nav verified.
- Last test report: `/app/test_reports/iteration_9.json` — `retest_needed: false`.

## Deployment
Preview: https://property-ops-60.preview.emergentagent.com · Production: https://property-ops-60.emergent.host (redeploy needed to publish this rework).

## Backlog / next priorities
- P1: Notification enhancement — email approval buttons for Management
- P2: Push notifications for pending approvals
- P2: Modularize `server.py` (~2300 lines) into APIRouter modules
- P2: Multi-language / locale toggle
