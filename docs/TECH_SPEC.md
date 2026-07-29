# Technical Specification — Real Estate Stakeholder Dashboard

For **developers and future maintainers**. Covers architecture, data
models, API surface, environment variables, and deployment.

> Looking for feature usage? See [User Guide](./USER_GUIDE.md).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Repository Layout](#repository-layout)
4. [Environment Variables](#environment-variables)
5. [Data Models (MongoDB)](#data-models-mongodb)
6. [Authentication & Authorization](#authentication--authorization)
7. [API Reference](#api-reference)
8. [Frontend Structure](#frontend-structure)
9. [Third-Party Integrations](#third-party-integrations)
10. [Scripts & Utilities](#scripts--utilities)
11. [Deployment](#deployment)
12. [Known Limitations & Backlog](#known-limitations--backlog)

---

## Architecture Overview

```
                ┌─────────────────────────────┐
                │  Browser (React 19 SPA)     │
                │  Tailwind + shadcn/ui       │
                └───────────────┬─────────────┘
                                │  HTTPS  (REACT_APP_BACKEND_URL)
                                ▼
                ┌─────────────────────────────┐
                │  Kubernetes ingress          │
                │  /api/*  →  backend:8001     │
                │  /*      →  frontend:3000    │
                └───────────────┬─────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
      ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
      │  FastAPI      │  │  MongoDB     │  │  Emergent    │
      │  (server.py)  │  │  (motor)     │  │  Object      │
      │  :8001        │  │              │  │  Storage     │
      └──────┬────────┘  └──────────────┘  └──────────────┘
             │
             ▼
      ┌──────────────┐
      │  Google      │
      │  Workspace   │
      │  SMTP        │
      └──────────────┘
```

- **All backend routes prefixed with `/api`** — Kubernetes ingress uses
  that prefix to route to the backend pod.
- Frontend **must** call `${REACT_APP_BACKEND_URL}/api/...` — never
  `localhost`.
- Backend and frontend both have **hot reload** via supervisor.

---

## Tech Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend framework | React 19 | Function components + hooks |
| Styling | Tailwind + shadcn/ui | Components in `/app/frontend/src/components/ui/` |
| Charts | Recharts | Bar, pie, line, KPI |
| Data fetching | TanStack Query (react-query) | Cached + optimistic updates |
| Client PDF | `jspdf` + `jspdf-autotable` | Table exports |
| Snapshot to PNG | `html-to-image` | Quick-share |
| Drag & drop | `@dnd-kit/sortable` | Dashboard customiser |
| Backend framework | FastAPI | Async |
| MongoDB driver | Motor | `motor.motor_asyncio` |
| Validation | Pydantic v2 | `ConfigDict(extra="ignore")` on all models |
| Auth | Custom JWT (HS256) + bcrypt | `pyjwt`, `bcrypt` |
| Excel | `openpyxl` | Server-side xlsx templates + exports |
| Email | `smtplib` | Google Workspace SMTP over TLS |

---

## Repository Layout

```
/app
├── backend/
│   ├── server.py                # All routes, models, business logic (~2.2k LOC)
│   ├── scripts/
│   │   └── reset_and_seed.py    # Wipe DB + seed admin user
│   ├── requirements.txt
│   └── .env                     # Mongo, SMTP, Emergent LLM key
├── frontend/
│   ├── src/
│   │   ├── App.js               # Routes
│   │   ├── index.js
│   │   ├── App.css / index.css
│   │   ├── components/
│   │   │   ├── ui/              # shadcn primitives
│   │   │   ├── Layout.jsx       # Sidebar + top nav
│   │   │   ├── DashboardCustomizer.jsx
│   │   │   ├── Shareable.jsx    # PNG snapshot wrapper
│   │   │   ├── RevenueTargets.jsx
│   │   │   ├── ProjectFilter.jsx
│   │   │   ├── GlobalSearch.jsx
│   │   │   └── NotificationsBell.jsx
│   │   ├── lib/
│   │   │   ├── api.js           # Axios client + auth interceptor
│   │   │   ├── auth.jsx         # AuthContext + JWT persistence
│   │   │   ├── onboarding.jsx   # Onboarding gate
│   │   │   ├── branding.jsx     # Company logo + name
│   │   │   ├── exporters.js     # jsPDF / xlsx helpers
│   │   │   └── utils.js
│   │   └── pages/
│   │       ├── Login.jsx, ResetPassword.jsx, Onboarding.jsx
│   │       ├── Dashboard.jsx, Projects.jsx, Units.jsx
│   │       ├── Revenue.jsx, Expenses.jsx, Stock.jsx
│   │       ├── Users.jsx, Settings.jsx
│   │       ├── ImportExcel.jsx, AuditLog.jsx
│   ├── package.json
│   └── .env                     # REACT_APP_BACKEND_URL
├── docs/
│   ├── USER_GUIDE.md
│   └── TECH_SPEC.md             # (this file)
├── memory/
│   ├── PRD.md                   # Product requirements + changelog
│   └── test_credentials.md      # Seeded admin creds
└── README.md
```

---

## Environment Variables

### `backend/.env`

| Key | Purpose |
| --- | --- |
| `MONGO_URL` | Mongo connection string (managed) |
| `DB_NAME` | Database name |
| `JWT_SECRET` | HS256 signing secret |
| `EMERGENT_LLM_KEY` | Emergent universal key (used by Object Storage) |
| `ADMIN_EMAIL` | Default admin (used only if you re-seed via env) |
| `ADMIN_TEMP_PASSWORD` | Default admin temp password (env-configurable) |
| `APP_PUBLIC_URL` | Full public URL used inside invite emails |
| `SMTP_HOST` | e.g. `smtp.gmail.com` |
| `SMTP_PORT` | e.g. `587` |
| `SMTP_USER` | Sender Google Workspace address |
| `SMTP_PASSWORD` | Google Workspace **App Password** |
| `SMTP_FROM_NAME` | Display name in email `From:` header |

### `frontend/.env`

| Key | Purpose |
| --- | --- |
| `REACT_APP_BACKEND_URL` | Public URL of the backend (used by axios) |

> **Never delete** the protected keys. Do not add default fallbacks in code
> — missing config must fail fast.

---

## Data Models (MongoDB)

Collections and key fields (documents are Pydantic-modelled server-side).
Every document has `created_at` (ISO string).

### `users`
```
user_id, email (unique), name, phone, picture, role,
project_ids: [str],
password_hash, must_reset_password: bool,
dashboard_config: { widgets: [str], order: [str] } | null,
is_active: bool, onboarding_completed: bool
```
`role ∈ { admin, accounts, management, site_manager }`

### `projects`
```
project_id, name, project_type, developer, address, city, state, pincode,
rera_number, start_date, expected_completion, total_units_planned,
target_revenue, image_url
```

### `unit_types`
```
unit_type_id, project_id, name, base_price, attributes (dict)
```

### `units`
```
unit_id, project_id, unit_type_id?, unit_number, price, status,
attributes (dict), buyer_name?, sold_at?, reservation_expires_at?
```
`status ∈ { available, reserved, sold, cancelled }`

### `payments`
```
payment_id, project_id, unit_id, amount, mode, paid_on, note
```

### `revenue_targets`
```
target_id, project_id, period_type, period_key, amount
```
`period_type ∈ { monthly, quarterly }`. `period_key` e.g. `2026-02` or `2026-Q1`.

### `expenses`
```
expense_id, project_id, category, vendor, amount, expense_date, description,
receipt_file_id, raised_by,
stage1_status, stage1_by, stage1_at, stage1_reason,
final_status, final_by, final_at, final_reason
```
Status enum: `pending | approved | rejected`.

### `stock_items`
```
stock_id, project_id, name, unit, opening
```

### `stock_movements`
```
movement_id, stock_id, project_id, kind, quantity, moved_on, note
```
`kind ∈ { inward, outward }`.

### `notifications`
```
notification_id, user_id, kind, message, entity_type, entity_id,
is_read, created_at
```

### `audit_logs`
```
audit_id, actor_id, actor_role, action, entity_type, entity_id, meta, created_at
```

### `login_attempts`
```
_id (email-scoped key), count, locked_until
```
Used for brute-force protection (5 attempts / 15 min lockout).

### `settings` (singleton, `_id: "singleton"`)
```
company_name, currency, threshold_amount, logo_file_id
```

### `files`
```
file_id, path, content_type, size, is_public, uploaded_by, created_at
```

---

## Authentication & Authorization

- **Login:** `POST /api/auth/login` → bcrypt verify → return JWT
  (`sub = user_id`, `email`, 7-day expiry, HS256).
- **Token transport:** `Authorization: Bearer <jwt>` (frontend stores in
  `localStorage` and injects via axios interceptor).
- **Forced reset:** `must_reset_password=true` returned in login response;
  frontend redirects to `/reset-password` before allowing anything else.
- **Change password:** `POST /api/auth/change-password` — requires current
  password + new password (must differ from current).
- **Brute-force lockout:** 5 failed attempts within 15 minutes locks the
  account for 15 minutes; cleared on successful login.
- **RBAC:** `require_roles("admin", ...)` FastAPI dependency guards routes.
  Site managers are further constrained by `user_scope_projects()` which
  intersects their `project_ids`.

---

## API Reference

All routes prefixed with `/api`. Auth required unless marked **public**.

### Auth
| Method | Path | Roles |
| --- | --- | --- |
| POST | `/auth/login` | **public** |
| POST | `/auth/logout` | any |
| GET  | `/auth/me` | any |
| POST | `/auth/change-password` | any |

### Users
| Method | Path | Roles |
| --- | --- | --- |
| GET  | `/users` | admin |
| POST | `/users` | admin |
| PATCH | `/users/{user_id}` | admin |
| DELETE | `/users/{user_id}` | admin |
| POST | `/users/{user_id}/reset-password` | admin |

### Projects
| Method | Path | Roles |
| --- | --- | --- |
| GET  | `/projects` | any |
| POST | `/projects` | admin |
| PATCH | `/projects/{project_id}` | admin |
| DELETE | `/projects/{project_id}` | admin |
| GET  | `/projects/types` | any |
| GET  | `/projects/{project_id}/impact` | admin |
| POST | `/projects/{project_id}/image` | admin |

### Units & Inventory
| Method | Path | Roles |
| --- | --- | --- |
| GET  | `/unit-types` | any |
| POST | `/unit-types` | admin |
| GET  | `/units` | any (scoped) |
| POST | `/units` | admin |
| POST | `/units/bulk` | admin |
| POST | `/units/bulk-import` | admin |
| GET  | `/units/bulk-template` | admin |
| POST | `/units/{unit_id}/sell` | admin, accounts |
| POST | `/units/{unit_id}/reserve` | admin, accounts |
| POST | `/units/{unit_id}/release` | admin, accounts |
| POST | `/units/{unit_id}/cancel` | admin |

### Revenue / Payments / Targets
| Method | Path | Roles |
| --- | --- | --- |
| GET  | `/payments` | admin, accounts, management |
| POST | `/payments` | admin, accounts |
| GET  | `/revenue/summary` | admin, accounts, management |
| GET  | `/revenue-targets` | admin, accounts, management |
| POST | `/revenue-targets` | admin, accounts |
| DELETE | `/revenue-targets/{target_id}` | admin |
| GET  | `/revenue-targets/variance` | admin, accounts, management |

### Expenses
| Method | Path | Roles |
| --- | --- | --- |
| GET  | `/expenses` | any (scoped) |
| POST | `/expenses` | any (raiser) |
| POST | `/expenses/{expense_id}/stage1` | accounts, admin |
| POST | `/expenses/{expense_id}/final` | management, admin |

### Stock
| Method | Path | Roles |
| --- | --- | --- |
| GET  | `/stock/items` | any (scoped) |
| POST | `/stock/items` | admin, site_manager (own project) |
| GET  | `/stock/movements` | any (scoped) |
| POST | `/stock/movements` | admin, site_manager (own project) |

### Files / Uploads
| Method | Path | Roles |
| --- | --- | --- |
| POST | `/files/upload` | any (as needed) |
| POST | `/files/logo` | admin |
| GET  | `/files/{file_id}/download` | any (public files public) |

### Excel & Exports
| Method | Path | Roles |
| --- | --- | --- |
| GET  | `/excel/template/{kind}` | admin |
| POST | `/excel/import/{kind}` | admin |
| GET  | `/exports/units` | any (scoped) |
| GET  | `/exports/expenses` | any (scoped) |
| GET  | `/exports/payments` | admin, accounts, management |
| GET  | `/exports/stock` | any (scoped) |

### Dashboard, Notifications, Search, Audit, Settings
| Method | Path | Roles |
| --- | --- | --- |
| GET  | `/dashboard/summary` | any |
| PATCH | `/me/dashboard-config` | any |
| GET  | `/notifications` | any |
| POST | `/notifications/{nid}/read` | any |
| POST | `/notifications/read-all` | any |
| GET  | `/search` | any (scoped) |
| GET  | `/audit-logs` | admin, accounts, management |
| GET  | `/settings/public` | **public** (branding for login screen) |
| GET  | `/settings` | any |
| PATCH | `/settings` | admin |
| GET  | `/onboarding/status` | any |
| POST | `/onboarding/complete` | admin |

---

## Frontend Structure

### Routing (`App.js`)
```
/login                → public
/reset-password       → forced when must_reset_password=true
/onboarding           → gated by onboarding_complete=false && role=admin
/                     → Dashboard (default)
/projects             → Projects list + create/edit
/projects/:id/units   → Units per project
/revenue              → Payments + Targets
/expenses             → Expense list + approvals
/stock                → Stock book per project
/users                → Admin only
/settings             → Admin only
/audit                → Admin/Accounts/Management
```

### State
- **Auth** — `AuthProvider` (in `lib/auth.jsx`) holds current user + JWT,
  persists to `localStorage`, exposes `logout()`.
- **Data** — TanStack Query with `queryKey`s per resource; cache
  invalidation on mutations.
- **Global search** — `⌘K` / `Ctrl+K` shortcut in `GlobalSearch.jsx`.
- **Notifications** — `NotificationsBell.jsx` polls `/notifications` every ~30s.

### Notable components
- **`DashboardCustomizer.jsx`** — `@dnd-kit/sortable` popover; each widget
  is a stable `id`; toggles + drag order both persist via
  `PATCH /me/dashboard-config`.
- **`Shareable.jsx`** — HOC that wraps any block, captures it as PNG via
  `html-to-image`, offers Download + Web Share API.
- **`RevenueTargets.jsx`** — inline CRUD for targets + variance strip.

---

## Third-Party Integrations

### Emergent Object Storage
- Uploaded files (project cover, company logo, expense receipts) via
  `POST /objects/{path}` to the Emergent storage endpoint.
- Uses `EMERGENT_LLM_KEY` for auth.
- Path convention: `realestate-dashboard/uploads/{scope}/{uuid}.ext`.

### Google Workspace SMTP
- Configured via `SMTP_*` env vars.
- Sender: `sales@agrocorp.co.in` / display name `Agrocorp Internal`
  (change via env).
- Uses **App Password** (2FA required on the Google account).
- Fires on every `POST /users` (invite). If SMTP not configured, the API
  returns the temp password inline so the admin can copy-share.

### Not integrated (yet)
- Outbound email for approval events (Resend / SendGrid) — P2.
- Push notifications — P2.

---

## Scripts & Utilities

### `/app/backend/scripts/reset_and_seed.py`
- Wipes every app collection.
- Seeds a single admin user (`sales@agrocorp.co.in` by default; edit
  constants in the script or parameterise if needed).
- Generates a fresh 14-char alphanumeric temp password.
- Prints the credentials to stdout — save them to `/app/memory/test_credentials.md`.
- Use before UAT or before first deploy.

```bash
cd /app/backend && python scripts/reset_and_seed.py
```

---

## Deployment

### Pre-flight checklist
- [ ] `.env` values verified (MONGO_URL, JWT_SECRET, SMTP_*, APP_PUBLIC_URL).
- [ ] Test password reset + email invite flow in preview.
- [ ] Test file upload (project cover + receipt) — object storage
      responds 200.
- [ ] `settings.threshold_amount` set to your desired 2-stage threshold.
- [ ] Company logo uploaded.
- [ ] All test users / test data cleared (or explicitly kept).

### Deploy via Emergent
1. Click **Deploy** in the chat interface.
2. Wait 10-15 minutes for the build + database provisioning.
3. Note the production URL.
4. **Re-seed the admin against the production DB** — production DB is
   separate from preview:
   ```
   cd /app/backend && python scripts/reset_and_seed.py
   ```
   (Run this against the production mongo — the deploy environment will
   have `MONGO_URL` pointing to the prod DB automatically.)
5. Save the new admin creds to `/app/memory/test_credentials.md`.
6. Share the URL + admin creds with your team.

### Custom domain
- Emergent **Deploy → Link domain → Entri** → follow DNS instructions.
- Remove any existing A records if propagation stalls.

### Rollback
- Free rollback to any previous deployment from the Emergent home tab.

---

## Known Limitations & Backlog

- **`server.py` is ~2.2k LOC** — should be split into `routers/` modules
  (`auth`, `users`, `projects`, `units`, `payments`, `expenses`, `stock`,
  `dashboard`, `files`). Non-blocking refactor.
- **No push email on approval events** — Management currently has to check
  the bell to see pending approvals. Planned via Resend.
- **No email-based one-click approve** — deep-link buttons in emails so
  Management can approve without logging in.
- **Login attempts** collection has no TTL index — cleared only on
  successful login. Add TTL to auto-expire lockout docs.
- **Radix a11y warning** — some `Dialog`s missing `DialogDescription`.
  Cosmetic, low priority.

Full backlog + priorities in `/app/memory/PRD.md`.
