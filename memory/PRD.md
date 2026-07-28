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

## Deferred / Backlog
- P2: Multi-tenant SaaS mode
- P2: Outbound email on approval events (Resend/SendGrid) — user chose to skip for now
- P2: PDF export of receipt-bearing expense records (currently only tabular PDF)
- P2: Revenue targets per project period (quarterly/monthly)
- P2: Auto-expire reservations by cron (kept manual per spec)
- P2: Vendor spend intelligence — click through to filtered expenses

## Next Tasks
1. Email notifications via Resend (when user provides key)
2. Auto-cron for reservation expiries (opt-in)
3. Per-project revenue targets (monthly/quarterly) with variance dashboard tile
