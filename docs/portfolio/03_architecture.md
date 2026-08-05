# Architecture

## Stack

**Backend** — FastAPI (Python 3.11), Uvicorn, Motor (async MongoDB), Pydantic v2, PyJWT, bcrypt, openpyxl, python-multipart.
**Frontend** — React 19, React Router v6, Tailwind CSS, Shadcn UI, Radix primitives, Axios, Sonner (toasts), Lucide (icons).
**Data** — MongoDB (managed instance in production, in-cluster in preview). 19 collections.
**Infra** — Kubernetes-hosted single-tenant deployment; supervisord process management; SMTP via env vars; Emergent Object Storage for future document vault.
**Auth** — JWT (HS256) with bearer header; 12-round bcrypt password hashes; 5-attempt lockout window.
**Cron** — Platform-managed via `.emergent/crons.yml`; secured with `WEBHOOK_CRON_SECRET` bearer.

## Repository layout

```
/app
├── backend/
│   ├── server.py                    # Single-file FastAPI app (~3960 lines).
│   ├── scripts/reset_and_seed.py    # DB wipe + admin provisioning (preview only).
│   ├── tests/                       # Pytest — 24 backend tests as of iter14.
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.js                   # Routes + Protected route wrapper.
│   │   ├── lib/
│   │   │   ├── api.js               # Axios instance + interceptors.
│   │   │   └── auth.jsx             # Auth context + role helpers.
│   │   ├── components/
│   │   │   ├── Layout.jsx           # Sidebar navigation + role-scoped links.
│   │   │   ├── ProjectFilter.jsx    # Shared project selector.
│   │   │   └── ui/                  # Shadcn components.
│   │   └── pages/                   # 22 pages (see feature matrix).
│   └── package.json
├── .emergent/
│   └── crons.yml                    # Platform-managed cron for reminders.
├── docs/portfolio/                  # This documentation.
└── memory/
    ├── PRD.md                       # Living product doc.
    └── test_credentials.md          # Seed credentials (redacted in prod).
```

## Data model (essentials)

### `users`
```
{
  user_id, email (unique idx), password_hash, role (Literal, 9 values),
  name, phone, picture, is_active, must_reset_password,
  onboarding_completed, project_ids: [str],
  legacy_role_before_migration?,   # audit trail
  created_at
}
```

### `projects`
```
{
  project_id, name, location, description, currency,
  rera_number?, image_url?, project_type ("residential" | "plots_land"),
  created_at, created_by
}
```

### `units` (the money-bearing entity)
```
{
  unit_id, project_id, plot_number, size, facing,
  plcs: [{label, amount}],
  price, discount, total_price,             # legacy summary numbers
  pricing: {                                # Wave 3 structured cost block
    bsp, plc, plc_breakdown: {east_facing, hill_view, corner, ...},
    oc1,                                    # Infrastructure & Development (pre-tax)
    oc2, oc2_breakdown: {legal, club, maintenance},
    ifms,                                   # Refundable, non-GST
    gst_rate, grand_total
  },
  status: UnitStatus (15 values),
  owner_name, owner_contact, owner_email,
  payment_plan_template_id,
  sold_by, sold_at,
  sales_approved_by, sales_approved_at, sales_review_note,
  schedule_created_by, schedule_created_at,
  legacy_status_before_migration?,          # audit trail
  previous_status_before_cancellation?,     # rollback support
  created_at
}
```

### `payment_templates`
```
{
  template_id, name, description,
  stages: [
    {
      name, trigger ("booking" | "days_from_booking" | "notice_of_possession"),
      days_from_start,
      percent,                              # legacy flat %
      bsp_percent, plc_percent, oc1_percent, oc2_percent,   # Wave 3
      apply_gst, charge_ifms
    }
  ],
  created_by, created_at
}
```

### `installments`
```
{
  installment_id, unit_id, project_id,
  stage_name, percent, amount,
  due_date, revised_due_date?,
  status: InstallmentStatus (13 values),
  promise_amount, promise_date, promise_notes,
  claimed_amount, claimed_at, claimed_by, claim_reference, claim_mode,
  verified_at, verified_by, received_amount,
  approved_at, approved_by,
  breakdown: {bsp, plc, oc1, gst_oc1, oc2, gst_oc2, ifms},
  trigger, deferred_until_nop
}
```

### `cancellations`
```
{
  cancellation_id, unit_id, project_id,
  initiated_by, initiated_at, reason,
  status: "pending_sales_review" | "pending_refund" | "refund_completed" | "rejected",
  sales_reviewed_by, sales_reviewed_at, sales_review_note,
  amount_paid_to_date, refund_amount,
  refund_reference, refund_mode, refund_paid_by, refund_paid_at, refund_notes
}
```

### `material_requests`
```
{
  request_id, project_id, subject, items: [{name, quantity, unit, notes}],
  justification, priority ("low" | "medium" | "high" | "urgent"),
  status: 5 values (pending_crm_review → pending_admin_review → pending_super_admin → approved | rejected),
  requested_by, requested_at,
  crm_reviewed_by, crm_reviewed_at, crm_note,
  admin_reviewed_by, admin_reviewed_at, admin_note,
  final_by, final_at, final_note,
  rejection_reason
}
```

### `notifications`
```
{ notification_id, user_id, kind, message, link?, is_read, created_at }
```

### `reminder_log`
```
{ _id: "rem:{installment_id}:{offset}", installment_id, unit_id,
  offset, sent_at, message }
```

Idempotency guarantee: `_id` is deterministic, so re-running the daily cron cannot double-fire.

### `audit_logs`
```
{ actor_id, action, entity, entity_id, delta, at }
```
Written on **every** mutating call — a permanent, queryable action log.

Other collections: `expenses`, `payments`, `tickets`, `stock_items`, `stock_movements`, `revenue_targets`, `settings`, `files`, `login_attempts`.

## API surface

**93 endpoints, all `/api/*` prefixed, all JWT-secured except `/api/health`, `/api/auth/login`, `/api/auth/forgot-password`.**

Grouped by domain:
- `auth` (7) — login · me · logout · change-password · forgot-password · reset-with-token · admin reset
- `users` (7) — CRUD + activate/deactivate + admin reset-password + upload picture
- `projects` (7) — CRUD + image upload + impact + types
- `units` (13) — list · CRUD · sell · approve-sale · cancel-sale · bulk-import · vv-import · preview-schedule · auto-schedule · request-cancellation
- `cancellations` (3) — list · sales-review · refund
- `material-requests` (4) — list · create · crm-review · admin-review · final
- `payment-templates` (3) — list · create · delete
- `installments` (6) — list · create-schedule · claim · verify · approve · promise-to-pay
- `notifications` (2) — list · mark-read
- `stock` (5), `tickets` (4), `expenses` (5), `payments` (4), `revenue` (4), `dashboard` (3)
- `setup` (1) — vv-payment-plans (idempotent seed)
- `admin` (1) — migrate-legacy-statuses
- `cron` (2) — reminders · reminders/run-now
- `files` (4) — upload · fetch · project image · logo
- `excel/import` (1), `audit/logs` (1), `health` (2)

## Key design decisions

**Single-file backend, deliberately.** `server.py` at ~3960 lines is deliberately un-split until the router-per-domain refactor in Wave 4. Rationale: while the domain model is still evolving weekly, a single file has fewer moving parts than premature modularization.

**Pydantic v2 with strict Literals for status/role.** Better data hygiene than free-form strings — but paired with lazy migration for legacy values (see `_LEGACY_ROLE_MAP` and `_LEGACY_UNIT_STATUS_MAP`) so the app never breaks for pre-existing prod data.

**Money math is server-side, always.** UI never computes an installment amount. The `compute_stage_amount(pricing, template_stage)` helper is the single source of truth, used by both the preview endpoint and the auto-schedule endpoint.

**Backward compatibility as a design principle.** `PlanStage.percent` (legacy flat %) still works alongside the new `bsp_percent + plc_percent + oc1_percent + oc2_percent` fields. Old plans in prod DB don't need migration.

**Every workflow transition is idempotent or protected against replay.**
- Cancellations reject "already in progress" on duplicate raise.
- Reminders skip already-logged (installment, offset) pairs.
- Legacy status migration is safe to re-run — the second call is a no-op.

**Print-to-PDF via browser, not server.** Cost sheet uses print-scoped Tailwind + `@page` A4 rules. Zero server-side rendering dependency, native OS print dialog, sub-second export.

**Cron endpoints ACK in <100ms.** `/api/cron/reminders` schedules the heavy work via `asyncio.create_task` and returns immediately — the platform doesn't retry.

## Sequence diagrams

### Booking a plot end-to-end

```
Sales Rep (UI)                Backend                  DB              Sales Head
     |                            |                     |                   |
     | PATCH /units/{id}/sell     |                     |                   |
     |--------------------------->| require_roles       |                   |
     |                            | (sales_rep+)        |                   |
     |                            | status_check(available)                 |
     |                            |-------------------->|                   |
     |                            | update status:      |                   |
     |                            | booked_pending_sales|                   |
     |                            |_approval            |                   |
     |                            |-------------------->|                   |
     |                            | audit_log           |                   |
     |                            |-------------------->|                   |
     |                            | notify(sales_head)  |                   |
     |                            |----------------------------------->     |
     |<---------------------------|                     |                   |
     |                                                                      |
     |                            (async in Sales Head worklist)            |
     |                            |                     |                   |
     |                            | POST /units/{id}/approve-sale  <--------|
     |                            | require_roles(sales_head+)              |
     |                            | status_check(booked_pending...)         |
     |                            | update status: sale_confirmed          |
     |                            |-------------------->|                   |
     |                            | audit_log + notify()|                   |
     |                            |-------------------->|                   |
```

### Reminder cron

```
Emergent Cron              Backend (accept)          Backend (worker)      SMTP
     |                          |                          |                 |
  08:00 IST                     |                          |                 |
     | POST /api/cron/reminders |                          |                 |
     |------------------------->| _cron_authorized()       |                 |
     |                          | task = create_task(_run_reminders())      |
     |                          | return 200 {accepted:true, run_id}         |
     |<-------------------------|                          |                 |
     |                                                     |                 |
     |                          (task runs asynchronously) |                 |
     |                          |                          | scan installments
     |                          |                          | dedupe via reminder_log
     |                          |                          | notify() to team
     |                          |                          | send_email() to team+customer
     |                          |                          |---------------->|
     |                          |                          | write reminder_log entries
```

## Testing philosophy

- **14 iteration reports** (`/app/test_reports/iteration_N.json`) covering every meaningful feature push
- Latest (**iter14 · Wave 2**): 24/24 backend tests + 5/5 frontend smoke tests passing
- Every subagent-driven testing round includes RBAC guardrail cases, idempotency cases, and negative paths
- Pytest suite lives at `/app/backend/tests/` and can be run against the running preview backend for CI

## Deployment topology

```
Emergent Platform
├── PREVIEW (dev)                 https://property-ops-60.preview.emergentagent.com
│   ├── Backend pod (FastAPI :8001)
│   ├── Frontend pod (React :3000)
│   ├── In-cluster MongoDB
│   └── Supervisord (hot reload)
│
├── PRODUCTION                    https://property-ops-60.emergent.host
│   ├── Backend (same code, prod env)
│   ├── Frontend (same code, prod env)
│   ├── Managed MongoDB (separate instance)
│   └── Managed cron (via .emergent/crons.yml)
│
└── Emergent Object Storage       (available; Wave 3 P1 document vault)
```

**Data flow between environments:** none. Preview and prod databases are fully isolated. Migrations are code + idempotent seed endpoints, not data snapshots.
