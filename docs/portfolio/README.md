# Agrocorp Admin — Portfolio Documentation Pack

Everything you need to build a portfolio deck for this project.

| File | Purpose | Use for |
|---|---|---|
| **[01_case_study.md](01_case_study.md)** | Full narrative — problem, solution, outcome, hard bits solved, numbers | Slide notes, portfolio site case-study page, blog post |
| **[02_features.md](02_features.md)** | Full feature matrix by wave · RBAC permissions table · workflow diagrams (ASCII/Mermaid) | Feature slide, "what it does" table, appendix |
| **[03_architecture.md](03_architecture.md)** | Stack · data model (all key collections) · API surface · design decisions · sequence diagrams · deployment topology | Technical slide, engineering-focused audience |
| **[04_screenshots.md](04_screenshots.md)** | Shot list — which URLs to screenshot for the deck, dimensions, and slide ordering | Actually building the deck |
| **[05_elevator_pitch.md](05_elevator_pitch.md)** | One-liner · one-paragraph · two-paragraph · résumé bullet · 5-min demo script | Cover slide, LinkedIn, résumé, verbal walkthrough |

## Recommended way to build the deck

1. Start with **`05_elevator_pitch.md`** → craft your cover slide + one-liner
2. Skim **`01_case_study.md`** → pull the "Numbers" table and "What was hard" section into two slides
3. Use **`04_screenshots.md`** as a checklist → take all 15 screenshots
4. Assemble deck in your tool of choice; use **`02_features.md`** as appendix content
5. Attach **`03_architecture.md`** as a printable technical addendum for interviewers who want depth

## Live URLs (as of this doc)

- **Production:** https://property-ops-60.emergent.host
- **Preview / dev:** https://property-ops-60.preview.emergentagent.com

## Quick facts sheet

- **93** JWT-secured REST endpoints
- **22** React pages
- **19** MongoDB collections
- **9** distinct roles enforced via strict Pydantic literals
- **15** plot lifecycle statuses
- **13** installment statuses
- **~3,960** lines in the single-file FastAPI backend
- **14** documented test-and-deploy iterations
- **256** units imported from a single RERA Excel with 0 errors
- **4** canonical payment plans that reconcile to the paisa against the cost sheet
- **3** production deploys (Wave 1 · Wave 2 · Wave 3) with **zero data loss** across them

## Screenshots already captured

- `/tmp/cost_sheet_final.jpg` — the Cost Sheet Preview with a real prospect ("Amit Kumar") and the VV Time-Linked plan applied to Plot 1 of Vacation Village CKM
- `/tmp/cost_sheet_time_linked.jpg` — same, showing the 8-stage Time Linked schedule
- `/tmp/wave2_cxl.jpg` — Cancellations page (empty state)
- `/tmp/wave2_mr.jpg` — Material Requests page

*(These were taken during preview verification and may need to be re-taken from prod for the deck.)*

## Numbers you can cite verbatim

> *"Structured cost-sheet pricing with 8 distinct line items · component-aware payment plans that reconcile Excel-perfect · 93 JWT-secured REST endpoints · 22 React pages · 14 tested deploy cycles · 256-unit RERA sheet ingested in one API call · zero data loss across 3 production deploys."*

## Anything unclear or want more docs?

Tell me the audience for the deck (recruiters · engineering managers · potential clients · investors · academic) and I'll tailor a version.
