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

## Deferred / Backlog
- P1: Excel export for tables (currently only import + template)
- P1: Bulk unit creation UI (per project, quick generator)
- P1: Reserved-status flow (currently only available/sold/cancelled toggles via mark-sold)
- P2: Multi-tenant SaaS mode
- P2: Outbound email on approval events (Resend/SendGrid)
- P2: Company branding / logo upload in Settings
- P2: PDF export of receipt-bearing expense records
- P2: Revenue targets per project period (quarterly/monthly)
- P2: Site Manager scope for stock items shown in dashboard

## Next Tasks
1. Excel export from Units, Expenses, Payments tables
2. Company logo upload in Settings + surface across sidebar/login
3. Email notifications for approvals (Resend)
