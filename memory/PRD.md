# Real Estate Stakeholder Dashboard — PRD

## Original Problem Statement
A web-based internal dashboard for a real estate company to manage multiple projects — inventory, revenue, expenses (with two-stage approval), and site material stock — behind role-based logins.

## User Personas
- **Admin** — full control, user management, imports, settings
- **Accounts** — records payments, stage-1 expense approvals
- **Management** — final approver for expenses above threshold
- **Site Manager** — raises expenses, updates stock book, scoped to assigned project(s)

## Core Requirements (locked)
- 4 roles with RBAC
- Multi-project with site managers on **multiple** projects
- 2-stage expense approval (Accounts → Management, threshold-based)
- Emergent-managed Google Auth (first login bootstraps admin)
- Object storage for receipts (Emergent)
- Currency default **INR**
- Excel import for Projects/Units/Stock

## Architecture
- **Backend:** FastAPI (`/app/backend/server.py`), MongoDB (motor), Pydantic v2 models.
- **Frontend:** React 19 + shadcn/ui + Tailwind + Recharts + TanStack Query.
- **Auth:** Emergent Google OAuth → session_token stored in DB + httpOnly cookie + localStorage (for Bearer fallback).
- **Storage:** Emergent object storage (`realestate-dashboard/uploads/{user_id}/{uuid}.ext`).

## MongoDB Collections
users, user_sessions, projects, unit_types, units, payments, expenses, stock_items, stock_movements, audit_logs, notifications, files, settings.

## Implemented (v1 — 28 Feb 2026)
- [x] Emergent Google Auth + bootstrap admin
- [x] Projects CRUD with impact-preview delete
- [x] Unit types + Units + mark sold / cancel
- [x] Payments + Revenue summary (accrued/received/receivable)
- [x] Expenses 2-stage approval with rejection reasons + audit
- [x] Stock book (opening/inward/outward/closing)
- [x] User management (create/deactivate/role/project assign)
- [x] Excel template + import (projects, units, stock_items)
- [x] Dashboard analytics (Recharts: bar, pie, line, KPIs)
- [x] Notifications (bell + polling)
- [x] Global search (command palette)
- [x] Settings (threshold, currency, company)
- [x] Audit log
- [x] Object storage for receipts
- [x] RBAC middleware + role-aware sidebar

## Implemented (v2 — 28 Feb 2026 continued)
- [x] Reserved unit workflow (Admin reserves with buyer + expiry, manual release)
- [x] Bulk unit creator (prefix + start/end + zero-padding + base price, 500-unit cap)
- [x] Excel + PDF export on Units, Expenses, Payments, Stock Book tables (server xlsx, client jsPDF)
- [x] Company logo upload (Admin) — surfaced on sidebar + login
- [x] Public branding endpoint `/api/settings/public` for pre-login logo
- [x] Vendor spend intelligence strip on Dashboard (top 5, this month vs last, delta %)
- [x] Session expiry check on file downloads

## Implemented (v4 — 28 Feb 2026)
- [x] **Password auth** — replaces Emergent Google OAuth. JWT (HS256, 7-day), bcrypt hashing, brute-force lockout (5 attempts / 15 min), forced password reset on first login, admin reset-password endpoint.
- [x] **Admin seed on startup** — `admin@vistaestates.com / Vista@Admin#2026` (env-configurable, must_reset=true).
- [x] **Onboarding wizard (3 steps)** — Project → Inventory (manual OR bulk .xlsx/.csv) → Team, with role-gate that blocks dashboard until Accounts + Management + Site Manager all invited.
- [x] **Project types** — 5 (residential, commercial, plot, villa, mixed), each with its own field set (BHK/floor/carpet for residential, dimensions/facing/corner for plots, use_type/frontage for commercial, plot area / bedrooms for villas).
- [x] **Project schema** enriched with developer, address, city/state/pincode, RERA number, start_date, expected_completion, total_units_planned.
- [x] **Bulk unit import per type** — auto-generated .xlsx template with the right columns; .xlsx OR .csv upload; per-row error report; type-aware attribute coercion.
- [x] **User invites** with auto-generated 12-char secure temp password; best-effort SMTP send (Google Workspace App Password when configured); if SMTP not set, UI reveals the temp password with copy-button for manual sharing.
- [x] **Project edit + type-aware iconography** on Projects list.
- [x] **Quick-share** — `<Shareable>` wrapper captures any card/section as PNG (client-side, no backend hit) and offers download + Web Share API on supported browsers.
- [x] **Dashboard config API** (`/api/me/dashboard-config`) — persistence ready for widget picker + drag-drop UI (deferred to v5).
- [x] Security fixes from testing agent: ObjectId leak + password_hash leak plugged.

## Implemented (v5 — 28 Feb 2026)
- [x] **Google Workspace SMTP live** — invites now actually email out via `smtp.gmail.com` (from `sales@agrocorp.co.in` / "Agrocorp Internal"). Delivery confirmed by testing agent on real Gmail send. Graceful fallback if provider rejects.
- [x] **Dashboard drag-drop widget picker** — `@dnd-kit/sortable` powered popover; toggle any of 7 widgets on/off, drag to reorder, per-user persistence via `PATCH /api/me/dashboard-config`. Reset restores defaults.
- [x] **Project image upload** — `POST /api/projects/{id}/image` uploads to Emergent object storage (public) and patches `project.image_url`. Edit dialog now includes a Cover Image row with file input + live preview; card thumbnails update immediately.
- [x] Admin reset-password endpoint (`POST /api/users/{user_id}/reset-password`) — regenerates a temp password + optional email for locked-out users.

## Deferred / Backlog
- P2: Modularise server.py (currently 2200+ lines)
- P2: TTL index on login_attempts collection
- P2: DialogDescription for Radix a11y warning
- P2: Bulk-CSV team roster import for Fortune-500 rollouts

## Deferred / Backlog
- P2: Multi-tenant SaaS mode
- P2: Outbound email on approval events (Resend/SendGrid) — user chose to skip for now
- P2: PDF export of receipt-bearing expense records (currently only tabular PDF)
- P2: Revenue targets per project period (quarterly/monthly)
- P2: Auto-expire reservations by cron (kept manual per spec)
- P2: Vendor spend intelligence — click through to filtered expenses

## Implemented (v6 — Feb 2026)
- [x] **Database reset + admin seed for UAT** — `scripts/reset_and_seed.py` wipes all app collections and seeds a fresh admin (`sales@agrocorp.co.in`) with an auto-generated 14-char temp password (bcrypt, `must_reset_password=true`). Credentials stored in `/app/memory/test_credentials.md`.

## Next Tasks
1. User acceptance testing (in progress by user with fresh admin creds)
2. Email-based approval buttons for Management (P2)
3. Push/email notifications for pending approvals (P2)
4. Modularise `server.py` into APIRouter modules (P2 refactor)
