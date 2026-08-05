# Screenshots — Shot List for the Deck

*URLs assume you're logged in as `super_admin` on preview or prod. Take these at 1440 × 900 for crisp deck slides.*

## Hero shot (Slide 1 — "The product")

**URL:** `/cost-sheet/<any_unit_with_pricing_block>`
**What to show:** the cost sheet preview with prospect name filled in, VV - Time Linked plan selected. This is the most visually striking screen and instantly communicates "this is a real product, not a demo".

*Sample screenshot saved during Wave 3 verification:* `/tmp/cost_sheet_final.jpg` (256-unit dataset · Amit Kumar prospect · ₹49,74,364 grand total).

## Slide 2 — "The domain (why generic CRMs fail)"

A composite of two shots:

**Left half:** `/units` filtered by any project → shows plot statuses swimming across the 15-state lifecycle (available · booked_pending_sales_approval · sale_confirmed · post_sales_active · fully_paid · possession_completed · cancelled · available_for_resale).

**Right half:** any single unit's cost sheet preview at `/cost-sheet/<unit_id>` — annotate the 8 different cost components. This proves the point that a plot ≠ one price.

## Slide 3 — "9-role hierarchy in action"

**URL:** `/users`
**What to show:** the user list with different role pills visible (super_admin, sales_head, accounts_rep, site_supervisor, etc.). Also grab the profile page (`/profile`) as a small inset showing role-scoped project assignments.

## Slide 4 — "2-step sale approval"

Screen recording preferred; if still image:
1. `/units` — click "Mark Sold" on an available plot → dialog with owner details
2. `/sales-approvals` — the same plot appears in the Sales Head queue with approve/reject/return buttons

## Slide 5 — "3-step payment verification"

**URL:** `/crm/<unit_id>`
**What to show:** the CRM detail view with an installment mid-cycle — status = `payment_claimed` (yellow) or `not_reflected` (grey). Zoom into the claim → verify → approve chain visible on one installment.

## Slide 6 — "Cost sheet accuracy — before / after"

**Left:** the raw Excel from the developer (crop the header area showing the ~15 cost columns and formulas).
**Right:** the app's Cost Sheet Preview for the same plot showing identical numbers. This is your "one-Excel-line = one-app-row" comparison, extremely compelling for a portfolio.

## Slide 7 — "Component-aware payment plans"

Screenshot approach A — a table with all 4 plan schedules side-by-side (rows = milestones, columns = plan). Same plot, 4 different totals? Wrong — all 4 should reconcile to the same grand total, but the milestone splits differ. That's the wow.

Screenshot approach B — take `/cost-sheet/<unit>` four times, once per plan, and stack them 2×2 in a slide.

## Slide 8 — "Cancellations + refund workflow"

**URL:** `/cancellations`
**What to show:** at least one row in each column of the status board (Sales review · Refund pending · Completed · Rejected). If preview is empty, seed one cancellation via the UI first (Sales page → Cancel button).

## Slide 9 — "Site material request chain"

**URL:** `/material-requests`
**What to show:** the queue with a request at each of the four stages (CRM review · Process Admin · Super Admin · Approved). Requires seeding one or two records.

## Slide 10 — "Reminder engine"

**Two-part composite:**
- **Left:** `.emergent/crons.yml` opened in an editor — proves this is real platform-managed cron, not a hobby project timer.
- **Right:** any authenticated user's notification bell dropdown showing multiple payment_reminder entries. Also include a sample email screenshot.

## Slide 11 — "Bulk import Excel → 256 units in one call"

**Two shots:**
- **Left:** the actual RERA Excel file with a red arrow at the header row.
- **Right:** the successful API response: `{"inserted": 256, "errors": []}` in a JSON pretty-print.

Add a caption: *"14,654 rows · 224 columns Excel ingested with formula-aware `data_only=True` load and fuzzy header matching. Zero manual re-formatting."*

## Slide 12 — "Every action is signed"

**URL:** `/audit-log`
**What to show:** a filtered feed showing a variety of `action` values (create_project, sell_unit, approve_sale, claim_payment, verify_payment, approve_payment, request_cancellation, migrate_legacy_statuses).

## Slide 13 — "Legacy data migration"

Screenshot approach: a **before / after** of a Mongo query on the `units` collection showing:
- Before: `{plot_number:"41", status:"accounts_tracking"}`
- After: `{plot_number:"41", status:"post_sales_active", legacy_status_before_migration:"accounts_tracking"}`

Caption: *"Wave 3 introduced a strict 15-status Literal. Legacy production data was auto-migrated with a single super-admin endpoint. No downtime, no data loss."*

## Slide 14 — "Test coverage across 14 iterations"

Visual: a horizontal timeline with 14 dots (`iteration_1` … `iteration_14`) each colored by pass/fail. Latest dot huge and green with "24/24 backend + 5/5 frontend passing".

## Slide 15 — "The team"

**URL:** `/onboarding` (fresh super_admin flow)
**What to show:** the "invite team" step of the onboarding wizard — visually communicates that this is a multi-stakeholder product designed team-first.

## Bonus visuals to include if space allows

- **Dashboard KPIs** (`/dashboard`) — revenue accrued vs collected, aging buckets
- **Login page** — brand + welcome screen
- **Notification bell dropdown** — expanded state with 5+ notifications
- **Print preview of a cost sheet** — Ctrl+P on the cost sheet page shows how it exports to A4 clean

## How to take a clean screenshot on the app

1. Log in
2. Zoom your browser to **100%** exactly (Cmd+0 / Ctrl+0)
3. Set window to **1440 × 900** or **1920 × 1080** for consistent aspect ratio
4. Use **Chrome DevTools → Ctrl+Shift+P → "Capture full size screenshot"** if you need a full-page shot
5. For print preview (slide 11 bonus): open the cost sheet page → Ctrl+P → set "Destination: Save as PDF" → screenshot the print preview

## Suggested slide order for a 10-minute walkthrough deck

1. Hero (cost sheet)
2. The domain challenge (why generic CRMs fail)
3. 9-role hierarchy
4. Sale approval workflow
5. Payment verification workflow
6. Cost sheet accuracy — before/after Excel
7. Payment plans (all 4 side-by-side)
8. Cancellation + refund
9. Material request chain
10. Reminder engine + audit log
11. Excel bulk import → 256 units in one call
12. Numbers slide (93 endpoints · 22 pages · 14 test iterations · 3960 backend LOC · 256 units imported in 1 call · 4 plans reconciling to the paisa)
13. Roadmap (P0 Wave 3 finish → P1 Doc Vault + Reports → P2 Bank Recon)
14. Q&A
