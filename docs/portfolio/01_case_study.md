# Agrocorp Admin — Portfolio Case Study

*A production-grade post-sales & site operations platform for a plotted real estate developer.*

**Live product:** https://property-ops-60.emergent.host
**Timeline:** Built and iterated over 14 deploy cycles (documented via `iteration_1.json` → `iteration_14.json`)
**Stack:** FastAPI · React 19 · MongoDB · Tailwind + Shadcn UI · Emergent Object Storage

---

## The Problem

Plotted real-estate developers run **10+ interlocking workflows** that most CRMs never model correctly:

- **Inventory ≠ SKU.** Every plot has its own facing, PLC premiums, size, cost sheet, RERA disclosure.
- **Money ≠ one price.** A plot has BSP + PLC + Infrastructure charges + Legal & Admin + Club + 2-year Maintenance + GST + refundable IFMS — collected across 3–8 milestones on different schedules.
- **A booking is a chain of approvals**, not a single action. Sales Rep drafts → Sales Head approves → Accounts verifies → Accounts Head signs off.
- **Site operations run in parallel** to sales. Supervisors need materials; those requests go through CRM Head → Process Admin → Super Admin before procurement can act.
- **Cancellations happen** — and each one triggers refund workflows, plot re-releases, and inventory recycling.
- **Reminders** need to fire at T-2 / T-day / T+1 / T+3 / T+7 relative to a due date, to both team and customer.

Most off-the-shelf CRMs bill a plot as **one flat number** and force everything else into free-text notes. That breaks the moment Accounts asks "how much of Plot 41's revenue was GST-eligible OC1 vs refundable IFMS?"

## The Solution

A vertical, RBAC-first admin console that models the developer's real chart of accounts and real approval chain — designed to feel like an internal tool a small team of stakeholders actually enjoys using.

### Headline capabilities

| Capability | What it does |
|---|---|
| **9-role RBAC hierarchy** | Super Admin · Process Admin · CRM/Sales/Accounts Heads · CRM/Sales/Accounts/Post-Sales Reps · Site Supervisor — with per-project scope where needed |
| **Structured pricing model** | Every unit carries a `pricing` block: BSP · PLC (with facing breakdown) · OC1 · OC2 (with sub-line breakdown) · IFMS · GST rate · Grand Total |
| **Component-aware payment plans** | Each milestone specifies `bsp_percent · plc_percent · oc1_percent · oc2_percent · apply_gst · charge_ifms` — so a "10 % at booking + 100 % OC1 at 120 d + IFMS at possession" plan is a first-class object, not a spreadsheet macro |
| **2-step sale approval** | Sales Rep drafts booking → status `booked_pending_sales_approval` → Sales Head reviews → `sale_confirmed` |
| **3-step payment verification** | Post-Sales `claim` → Accounts Rep `verify` (bank statement match) → Accounts Head `approve` — every step signed and timestamped |
| **Cancellation + refund workflow** | Sales rep raises → Sales Head reviews → Accounts records refund reference/mode → unit auto-recycles to `available_for_resale` |
| **Site material request chain** | Site Supervisor requests → CRM Head reviews → Process Admin reviews → Super Admin final approves, with return-for-clarification and per-stage rejection notes |
| **Automated reminder engine** | Platform-managed cron at 08:00 IST daily; T-2 / T-day / T+1 / T+3 / T+7 in-app + email to team; T-2 / T-day / T+3 / T+7 email to customer. Idempotent via a per-(installment, offset) log |
| **Cost Sheet Preview** | Printable per-unit cost sheet + payment schedule side-by-side, customized with prospect name/phone/email, plan-switch on the fly, A4 print styles |
| **Excel bulk import** | Reads the developer's actual RERA cost sheet (with formulas via `data_only=True`), matches columns fuzzy-tolerant, upserts 256 units per file |
| **Promise-to-Pay tracking** | Installments carry a `promise_amount` / `promise_date` / `promise_notes` triple without ever losing the original due date |
| **Live in-app notifications + email** | Every workflow transition fans out to relevant roles via `notify()` (in-app) + `send_email()` (SMTP) |

## Outcome — what the client can actually do now

- **Book Plot 41** in three clicks and see the full 8-milestone Time-Linked schedule computed to the rupee against their own RERA cost sheet.
- **Share a printable cost sheet PDF** with a prospect from any plot in the inventory, personalized in ~10 seconds.
- **Cancel a booking** and know the plot is back on the market and the refund is queued to Accounts within one screen.
- **Import 256 units of a new project** from the RERA Excel file with a single API call. Zero manual reformatting.
- **Trust that reminders fire** without anybody remembering to click a button.

## Numbers

| Metric | Value |
|---|---|
| Backend endpoints | **93** (all `/api/...` scoped, JWT-protected) |
| Frontend pages | **22** |
| Distinct roles | **9** (strict Literal in Pydantic) |
| Plot statuses | **15** with legacy status migration for pre-Wave-1 data |
| Installment statuses | **13** (upcoming → due_today → paid, with `partial`, `promise_to_pay`, `rescheduled`, `waived`) |
| MongoDB collections | **19** |
| Backend LOC | ~3,960 (single-file FastAPI, planned for router-per-domain refactor) |
| Backend test iterations | **14** (`iteration_1.json` → `iteration_14.json`); latest 24/24 passing |
| Real cost sheets ingested (test) | **256 units** in one call, 0 errors, grand totals matched to ₹0.01 |
| Deploys to production | 3+ (Wave 1 · Wave 2 · Wave 3) with zero data loss between deploys |

## What was hard (and how it was solved)

**1. Legacy data migration without downtime.**
Pre-Wave-1 users had role `admin`. Pre-Wave-1 units had status `accounts_tracking`. Post-Wave-1 code used stricter Pydantic literals that rejected those values → every authenticated call 500'd for legacy accounts.
**Fix:** Transparent read-time migration in `get_current_user` (roles) + a super-admin-invocable `POST /api/admin/migrate-legacy-statuses` (units). Old values kept in `legacy_*_before_migration` fields for audit.

**2. Payment plans that charge different cost components at different milestones.**
Off-the-shelf apps model plans as flat `% × total_price`. Real plans charge BSP+PLC at booking, OC1 later, OC2 + IFMS at possession, with GST layered per component. And "Down Payment Plan" charges the PLC only at Instalment-2 while BSP flows separately.
**Fix:** Made `PlanStage` a first-class model with `bsp_percent · plc_percent · oc1_percent · oc2_percent · apply_gst · charge_ifms` and a component-aware `compute_stage_amount()` helper. Verified all four canonical plans reconcile to grand total to the paisa.

**3. Excel that ships as formulas, not values.**
`openpyxl` returns formula strings unless you pass `data_only=True`. First run of the importer wrote all zeros to the DB.
**Fix:** Explicit `data_only=True` load + fuzzy column-header matching to survive header wording drift across future cost sheets.

**4. Cron endpoints must ACK 2xx immediately or the platform retries them.**
**Fix:** `POST /api/cron/reminders` schedules the actual scan+dispatch as a background task via `asyncio.create_task()` and returns `{"accepted": true, "run_id": ...}` in <100ms.

**5. Cost sheet must print cleanly to A4.**
**Fix:** Print-scoped Tailwind utilities (`print:hidden`, `print:bg-white`, `print:border-0`) + `@page` rule for A4 margins. No third-party PDF library — the browser's native "Save as PDF" produces flawless output.

## Design principles

- **Server owns truth.** Every calculation (installment amounts, GST, grand totals, aging) is done backend-side. The UI never re-derives money.
- **Every workflow action is signed.** Any state transition writes an `audit_logs` entry with `{actor_id, action, entity, entity_id, delta, at}`.
- **No wrapper for wrapper's sake.** `server.py` stays single-file until it needs routing/domain separation — deliberately postponed until Wave 4.
- **Every model is component-aware.** The pricing block would be identical for a Vacation Village unit and an entirely different township — only the numbers change.

## What's next (roadmap the deck can show)

- **P0 · Wave 3 (in progress):** Cost Sheet Preview (shipped), NoP endpoint to shift deferred stages, Bulk Import UI on Project detail page
- **P1:** Customer Document Vault (KYC + agreements + receipts on Emergent Object Storage), Reports Pack (aging, collection, outstanding, sales performance)
- **P2:** Bank reconciliation via statement import + auto-match, Communication timeline per customer, Full site procurement (quotation → PO → payment → receipt)
- **Tech debt:** Break `server.py` into feature routers, add pytest coverage per-router, add optimistic-concurrency `_version` on units

---

*Documentation package generated from live source and iteration reports on the date of the deck — every number is verifiable against the running preview environment.*
