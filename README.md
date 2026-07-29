# Real Estate Stakeholder Dashboard

A web-based internal dashboard for a real estate company to manage multiple
projects — **inventory, revenue, expenses (2-stage approval), and site
material stock** — behind role-based logins.

Built for internal use by admins, accountants, management, and site managers.

---

## Quick Links

- **[User Guide](./docs/USER_GUIDE.md)** — how to use the app (for admins,
  accountants, management, site managers).
- **[Tech Spec](./docs/TECH_SPEC.md)** — architecture, data models, API
  reference, environment variables, deployment.
- **[Product Requirements (PRD)](./memory/PRD.md)** — original problem
  statement + implementation changelog.
- **[Test Credentials](./memory/test_credentials.md)** — seeded admin login
  for UAT.

---

## What This App Does (at a glance)

| Module | What it lets you do |
| --- | --- |
| **Projects** | Create/edit projects with 5 project types (residential, commercial, plot, villa, mixed-use), cover images, RERA, timelines. |
| **Units / Inventory** | Manage units per project with type-specific fields; bulk-create with prefix + range; import from `.xlsx` / `.csv`; sell / reserve / cancel. |
| **Revenue** | Record payments, view accrued vs received vs receivable, set monthly / quarterly targets, see variance tiles. |
| **Expenses** | Site managers raise → Accounts approves stage-1 → Management gives final approval, with rejection reasons and receipt uploads. |
| **Stock Book** | Track opening / inward / outward / closing quantities of site materials. |
| **Users** | Admin invites teammates via real email (Google Workspace SMTP); forced password reset on first login; roles: `admin`, `accounts`, `management`, `site_manager`. |
| **Dashboard** | Drag-and-drop widget picker, KPIs, revenue charts, vendor spend intelligence, quick-share any card as PNG. |
| **Reports** | Excel and PDF export on Units / Expenses / Payments / Stock tables. |
| **Audit Log** | Every action recorded with actor + timestamp. |

---

## Tech Stack (short version)

- **Frontend:** React 19 · Tailwind · shadcn/ui · Recharts · TanStack Query
- **Backend:** FastAPI · Motor (async MongoDB) · Pydantic v2
- **Database:** MongoDB
- **Auth:** Custom JWT (HS256) + bcrypt, forced first-login reset, brute-force lockout
- **Email:** Google Workspace SMTP (`smtplib`) for user invites
- **Storage:** Emergent Object Storage for logos / project covers / receipts
- **Exports:** `openpyxl` (server-side xlsx), `jspdf` + `autoTable` (client-side PDF), `html-to-image` (JPG snapshots)

See **[Tech Spec](./docs/TECH_SPEC.md)** for the full details.

---

## Running Locally (dev)

The app runs on Emergent's managed infra (supervisor + hot reload). You
normally don't need to start anything manually.

```
# Backend:  0.0.0.0:8001   (FastAPI, hot reload)
# Frontend: 0.0.0.0:3000   (React dev server, hot reload)
# Public:   $REACT_APP_BACKEND_URL   (Kubernetes ingress → /api → backend)
```

**Restart when you change `.env` or install deps:**
```bash
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
```

**Reset the database + seed a fresh admin:**
```bash
cd /app/backend && python scripts/reset_and_seed.py
```
This wipes every collection and prints the seeded admin email + temp
password. Credentials are also written to `/app/memory/test_credentials.md`.

---

## Publishing / Deployment

Use Emergent's **Deploy** button in the chat interface. Production DB is
separate from preview — after the first deploy, re-run
`scripts/reset_and_seed.py` against the production Mongo to seed the live
admin. See **[Tech Spec → Deployment](./docs/TECH_SPEC.md#deployment)** for
the full checklist.

---

## Project Structure

```
/app
├── backend/
│   ├── server.py                # FastAPI app (all routes + models)
│   ├── scripts/
│   │   └── reset_and_seed.py    # Wipe DB + seed admin
│   ├── requirements.txt
│   └── .env                     # Mongo, SMTP, Emergent LLM key
├── frontend/
│   ├── src/
│   │   ├── App.js               # Routing
│   │   ├── pages/               # Dashboard, Projects, Units, Revenue, Expenses, Stock, Users, Settings…
│   │   ├── components/          # DashboardCustomizer, Shareable, Layout, GlobalSearch, RevenueTargets…
│   │   └── lib/                 # api.js, auth.jsx, onboarding.jsx, exporters.js, branding.jsx
│   ├── package.json
│   └── .env                     # REACT_APP_BACKEND_URL
├── docs/
│   ├── USER_GUIDE.md
│   └── TECH_SPEC.md
└── memory/
    ├── PRD.md
    └── test_credentials.md
```

---

## Roles at a Glance

| Role | Can do |
| --- | --- |
| **Admin** | Everything: user management, project CRUD, settings, imports, final approvals. |
| **Accounts** | Record payments, run stage-1 expense approval, view revenue & audit. |
| **Management** | Final approver for expenses above threshold; strategic dashboards. |
| **Site Manager** | Raise expenses, update stock book, view assigned projects only. |

Full permission matrix in the **[User Guide](./docs/USER_GUIDE.md#roles--permissions)**.
