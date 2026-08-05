# Elevator Pitch — one-paragraph and one-liner

## One-liner
*A vertical ERP for plotted real-estate developers that models RERA cost sheets, multi-step approvals, and site operations as first-class objects — replacing the WhatsApp-plus-Excel workflow that dominates the industry.*

## One-paragraph (deck cover / résumé line)
Agrocorp Admin is a full-stack post-sales and site-operations platform I designed and built for a plotted real-estate developer. It replaces spreadsheet-and-WhatsApp workflows with a 9-role RBAC hierarchy, a 15-state plot lifecycle, structured cost-sheet pricing (BSP · PLC · Other Charges · GST · IFMS), component-aware payment plans that reconcile Excel-perfect, and platform-managed cron-driven reminders. Behind the surface: 93 JWT-secured APIs, 22 React pages, 19 MongoDB collections, 14 tested deploy cycles, and a live production instance running on Emergent's Kubernetes platform.

## Two-paragraph (portfolio site "About" section)
Real-estate developers price a plot with a compound cost sheet — Basic Sale Price, PLC premiums for facing and corner, Infrastructure charges, Legal & Admin, Club membership, Advance Maintenance, GST on each layer, and a refundable IFMS deposit. Then they charge those components across 3-to-8 milestones on completely different schedules. Every generic CRM I saw modeled a plot as *one number* and forced everything else into free-text notes. That breaks the moment Accounts asks *"how much of Plot 41's revenue was GST-eligible OC1 versus refundable IFMS?"*

Agrocorp Admin is my answer. Every unit carries a structured pricing block; every payment plan stage declares which cost component it charges (and whether GST applies to it); every workflow — sale approval, payment verification, cancellation refund, site material request — moves through a signed, auditable RBAC chain with in-app + email fan-out at each transition. The system ingests 256 units from a formula-heavy RERA Excel in one API call, reconciles all four canonical payment plans to the paisa, and produces printable per-prospect cost sheets in under a second. It ships to production via a two-environment Emergent deployment with idempotent migrations and legacy-data auto-migration built in from day one.

## LinkedIn / résumé bullet
- Designed and shipped **Agrocorp Admin**, a full-stack post-sales & site-operations platform for a plotted real-estate developer. **93 REST endpoints, 22 React pages, 19 Mongo collections, live in production.** Key technical wins: component-aware payment plans that reconcile RERA Excel to the paisa; auto-migration of legacy roles and unit statuses with zero downtime; platform-managed cron reminder engine with per-installment idempotency; single-file FastAPI backend with strict Pydantic v2 literals and lazy backward-compatibility for pre-schema-change data.

## Talking points for a 5-minute demo

1. **"Show me a plot."** Open `/units` — 15 statuses, 256 imported units, filterable by project.
2. **"Show me the money."** Click any unit's cost sheet icon — full breakdown side-by-side with the schedule for whatever plan is linked.
3. **"Now switch the plan."** Change plan selector on the cost sheet page — schedule reprojects instantly, still reconciles to grand total.
4. **"Book the plot."** Back to `/units` → Mark Sold → drop into `/sales-approvals` as Sales Head → approve. Watch status flip through the lifecycle.
5. **"Now payments."** `/crm/<unit_id>` → claim → verify → approve chain visible on any installment.
6. **"Something went wrong — cancel it."** Sales page → Cancel button → drop into `/cancellations` → approve → Accounts records refund → plot back to available_for_resale.
7. **"Reminders fire without anybody clicking."** Show `.emergent/crons.yml`, show `reminder_log` collection, show notification bell full of `payment_reminder` entries.
8. **"And it's tested and deployed."** Show `/app/test_reports/iteration_14.json` (24/24 pass) and the live prod URL.
