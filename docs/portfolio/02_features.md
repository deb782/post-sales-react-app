# Feature Matrix

*Complete, tested, in-production capabilities of Agrocorp Admin as of Wave 3.*

## Wave 0 — Foundation

| Feature | Status | Notes |
|---|---|---|
| JWT authentication with bcrypt | ✅ Prod | 12-round bcrypt; 15-min token TTL configurable |
| Forced first-login password reset | ✅ Prod | `must_reset_password` flag drives the flow |
| Public "Forgot Password" flow | ✅ Prod | 20-minute one-time recovery token, SMTP-delivered |
| Brute-force lockout | ✅ Prod | 5-attempt threshold, cooldown auto-resets |
| Multi-project support | ✅ Prod | Users optionally scoped to a subset of `project_ids` |
| Onboarding wizard (Super Admin) | ✅ Prod | Team-first setup — invite team → first project |
| Audit log | ✅ Prod | Every mutation writes an `audit_logs` entry |
| In-app notifications + bell | ✅ Prod | Live in every workflow transition |
| Email dispatch | ✅ Prod | SMTP; retryable, non-blocking |
| `/health` + `/api/health` liveness | ✅ Prod | For Kubernetes probes |

## Wave 1 — Post-sales foundations

| Feature | Status | Endpoint / Screen |
|---|---|---|
| 9-role RBAC hierarchy | ✅ Prod | `Role` literal; enforced via `require_roles(...)` |
| Legacy role auto-migration | ✅ Prod | `get_current_user` transparently maps pre-Wave-1 roles |
| 15 plot statuses (extended lifecycle) | ✅ Prod | `available` → 15 states → `available_for_resale` |
| 2-step sale approval | ✅ Prod | `PATCH /units/{id}/sell` → `POST /units/{id}/approve-sale` |
| 3-step payment verification | ✅ Prod | `claim` → `verify` → `approve` on `/installments/{id}` |
| Promise-to-Pay tracking | ✅ Prod | `promise_amount + promise_date + promise_notes` |
| Extended installment statuses (13) | ✅ Prod | `upcoming` · `due_soon` · `due_today` · `overdue` · `promise_to_pay` · `partial` · `waived` · `rescheduled` · … |
| Sales Approvals queue page | ✅ Prod | `/sales-approvals` — Sales Head worklist |
| User profile page | ✅ Prod | `/profile` — self-service password change + profile edit |

## Wave 2 — Cancellations · Materials · Reminders

| Feature | Status | Endpoint / Screen |
|---|---|---|
| Booking cancellation + refund workflow | ✅ Prod | `/cancellations` page + 3 endpoints (request → sales-review → refund) |
| Auto-release plot to `available_for_resale` on completion | ✅ Prod | Refund step clears owner + pricing + plan link |
| Zero-payment fast-path | ✅ Prod | Cancellations with `refund_amount == 0` skip the accounts step |
| Site material request chain | ✅ Prod | `/material-requests` page + 4-stage approval endpoints |
| Return-for-clarification on material requests | ✅ Prod | Non-terminal status; requester gets an in-app + email nudge |
| Automated reminder engine | ✅ Prod | `.emergent/crons.yml` → `/cron/reminders` at 08:00 IST |
| Reminder idempotency | ✅ Prod | Per-`(installment, offset)` entry in `reminder_log` |
| Team + customer reminder split | ✅ Prod | Team = 5 offsets; customer = 4 offsets (T-2/T-day/T+3/T+7) |
| Manual reminder trigger | ✅ Prod | `POST /cron/reminders/run-now` — super_admin only |

## Wave 3 — Cost-sheet accuracy

| Feature | Status | Endpoint / Screen |
|---|---|---|
| Structured `Unit.pricing` block | ✅ Prod | BSP · PLC + breakdown · OC1 · OC2 + breakdown · IFMS · GST · Grand Total |
| Component-aware `PlanStage` | ✅ Prod | `bsp_percent`, `plc_percent`, `oc1_percent`, `oc2_percent`, `apply_gst`, `charge_ifms`, `trigger` |
| `trigger` field (booking / days_from_booking / notice_of_possession) | ✅ Prod | Enables deferred stages that fire on NoP, not calendar days |
| Legacy plan compatibility | ✅ Prod | Flat-`percent` plans still work (backward compatible) |
| `compute_stage_amount()` helper | ✅ Prod | One function powers preview + auto-schedule |
| `POST /units/{id}/auto-schedule` | ✅ Prod | Generates the full installment schedule from unit × template |
| `GET /units/{id}/preview-schedule` | ✅ Prod | Non-persistent preview for the Cost Sheet page |
| Cost Sheet Preview page | ✅ Prod | `/cost-sheet/:unitId` — prospect fields, plan switch, print-to-PDF |
| VV cost sheet Excel importer | ✅ Prod | `POST /units/vv-import` — 256 units in one call, formula-aware |
| VV payment plan seed | ✅ Prod | `POST /setup/vv-payment-plans` — idempotent, 4 named plans |
| Legacy unit-status migration | ✅ Prod | `POST /admin/migrate-legacy-statuses` — one-shot, idempotent, preserves original |
| Bulk-import UI (upload widget on Projects page) | 🚧 Backlog | API-only for now; UI in Wave 3 P1 |
| NoP-issued endpoint (`mark-nop-issued`) | 🚧 Backlog | Deferred stages currently placeholder at booking + 365d |
| "Email cost sheet to prospect" | 🚧 Backlog | Currently browser-print PDF |

## RBAC matrix

| Action | super_admin | process_admin | crm_head | sales_head | accounts_head | sales_rep | post_sales_rep | accounts_rep | site_supervisor |
|---|---|---|---|---|---|---|---|---|---|
| Create/edit unit | ✅ | ✅ | — | — | — | — | — | — | — |
| Book a plot (draft sale) | ✅ | ✅ | — | ✅ | — | ✅ | — | — | — |
| Approve sale | ✅ | — | — | ✅ | — | — | — | — | — |
| Create installment schedule | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Claim payment | ✅ | — | ✅ | — | — | — | ✅ | — | — |
| Verify payment (bank) | ✅ | — | — | — | ✅ | — | — | ✅ | — |
| Approve payment | ✅ | — | — | — | ✅ | — | — | — | — |
| Request cancellation | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | — |
| Sales-review cancellation | ✅ | — | — | ✅ | — | — | — | — | — |
| Record refund | ✅ | — | — | — | ✅ | — | — | ✅ | — |
| Raise material request | ✅ | ✅ | ✅ | — | — | — | — | — | ✅ |
| CRM-review material request | ✅ | — | ✅ | — | — | — | — | — | — |
| Admin-review material request | ✅ | ✅ | — | — | — | — | — | — | — |
| Final-approve material request | ✅ | — | — | — | — | — | — | — | — |
| Migrate legacy statuses | ✅ | — | — | — | — | — | — | — | — |
| Seed VV plans | ✅ | ✅ | — | — | — | — | — | — | — |
| Import cost sheet | ✅ | ✅ | — | — | — | — | — | — | — |
| Manual reminder trigger | ✅ | — | — | — | — | — | — | — | — |

## Workflow diagrams (Mermaid)

### Sale approval

```
Sales Rep drafts sale                              (unit: available → booked_pending_sales_approval)
        ↓
Sales Head reviews
        ├── approve → status: sale_confirmed → CRM sets schedule → post_sales_active
        └── reject  → status: available (unit released)
```

### Payment verification

```
Post-Sales Rep claims payment                      (installment: due → payment_claimed)
        ↓
Accounts Rep verifies against bank statement       (→ not_reflected | partial | pending_head_approval)
        ↓
Accounts Head approves                             (→ paid)
```

### Cancellation + refund

```
Sales Rep raises cancellation request              (unit: sale_confirmed → cancellation_requested)
        ↓
Sales Head reviews
        ├── approve + refund > 0 → unit: cancelled → Accounts refund step
        │                                             ↓
        │                                    Accounts records refund → unit: available_for_resale
        ├── approve + refund = 0 → unit: available_for_resale (immediate)
        └── reject → unit: previous_status_before_cancellation (rolled back)
```

### Site material request

```
Site Supervisor raises request                     (status: pending_crm_review)
        ↓
CRM Head reviews
        ├── approve → pending_admin_review
        ├── reject  → rejected
        └── return  → note recorded, still pending_crm_review
        ↓
Process Admin reviews
        ├── approve → pending_super_admin
        ├── reject  → rejected
        └── return  → pending_crm_review
        ↓
Super Admin final
        ├── approve → approved  (stock logged manually)
        └── reject  → rejected
```
