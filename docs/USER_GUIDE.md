# User Guide — Real Estate Stakeholder Dashboard

For **admins, accountants, management, and site managers**. Explains every
screen and every user-facing feature. No code inside.

> Looking for architecture / APIs / env vars? See [Tech Spec](./TECH_SPEC.md).

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Roles & Permissions](#roles--permissions)
3. [First-Time Login & Onboarding](#first-time-login--onboarding)
4. [Dashboard](#dashboard)
5. [Projects](#projects)
6. [Units / Inventory](#units--inventory)
7. [Revenue & Payments](#revenue--payments)
8. [Revenue Targets & Variance](#revenue-targets--variance)
9. [Expenses (2-Stage Approval)](#expenses-2-stage-approval)
10. [Stock Book](#stock-book)
11. [Users & Invites](#users--invites)
12. [Settings & Branding](#settings--branding)
13. [Notifications](#notifications)
14. [Global Search](#global-search)
15. [Exports (Excel & PDF)](#exports-excel--pdf)
16. [Quick-Share as JPG](#quick-share-as-jpg)
17. [Audit Log](#audit-log)
18. [FAQ](#faq)

---

## Getting Started

1. Open the app URL provided by your admin.
2. Log in with the email + temporary password you received in your **invite
   email**.
3. You'll be forced to set a new password on first login.
4. Complete the 3-step onboarding wizard (only shown for the very first admin).
5. You land on the Dashboard.

---

## Roles & Permissions

| Feature | Admin | Accounts | Management | Site Manager |
| --- | :-: | :-: | :-: | :-: |
| Invite / deactivate users | ✅ | | | |
| Create / edit / delete projects | ✅ | | | |
| Create / edit units, bulk import | ✅ | | | |
| Sell / reserve / cancel units | ✅ | ✅ | | |
| Record payments | ✅ | ✅ | | |
| Set revenue targets | ✅ | ✅ | | |
| Raise expenses | ✅ | ✅ | ✅ | ✅ |
| Stage-1 expense approval | ✅ | ✅ | | |
| Final expense approval | ✅ | | ✅ | |
| Update stock book | ✅ | | | ✅ (assigned projects) |
| Change company settings | ✅ | | | |
| View audit log | ✅ | ✅ | ✅ | |

**Project scoping:** Site managers only see the projects they've been
assigned to. Admin / Accounts / Management see all projects unless a
project filter is applied.

---

## First-Time Login & Onboarding

**Forced password reset:** Your temp password only works once. You'll be
asked for a new one immediately after login.

**Onboarding wizard (admin only, first-time):** three steps:

1. **Create your first project** (name, project type, location, target revenue).
2. **Add inventory** — either manually or upload an `.xlsx` / `.csv` template.
3. **Invite your team** — you must invite at least one Accounts, one
   Management, and one Site Manager to unlock the dashboard.

You can revisit any step until you finish.

---

## Dashboard

The landing screen after login. Includes:

- **KPI tiles:** total revenue, receivable, expenses this month, units sold, etc.
- **Revenue chart:** monthly revenue trend (bar / line).
- **Inventory pie:** available / sold / reserved / cancelled per project.
- **Recent expenses:** with approval status badges.
- **Vendor spend intelligence:** top 5 vendors this month vs last month with delta %.
- **Revenue variance tile:** actuals vs target (this month / quarter).

**Personalise your dashboard:**
- Click the **Customise** button (top-right).
- Toggle any widget on/off.
- Drag any widget by its handle to reorder.
- Click **Reset** to restore defaults.
- Changes are saved to your profile.

---

## Projects

### Create a project
1. Go to **Projects** → **New Project**.
2. Pick a **project type**:
   - **Residential** — BHK, floor, carpet area
   - **Commercial** — use type, frontage
   - **Plot** — dimensions, facing, corner
   - **Villa** — plot area, bedrooms
   - **Mixed-use** — combination
3. Fill developer, address, city, state, pincode, RERA number, start date,
   expected completion, total units planned, target revenue.
4. (Optional) Upload a **cover image** — shown on the project card.
5. Save.

### Edit / cover image
- Click the pencil icon on a project card.
- Change any field or upload a new cover image.
- Live preview shows the new image before saving.

### Delete
- Click delete → you'll see an **impact preview** showing how many users,
  units, expenses, and payments are linked.
- Confirm to remove (cascades handled server-side).

---

## Units / Inventory

### Manual add
Go to a project → **Units** → **New Unit**. Fields adapt to the project type.

### Bulk create (pattern-based)
For projects with predictable numbering (e.g. `A-101` … `A-125`):
1. Click **Bulk create**.
2. Enter **prefix** (`A-`), **start** (101), **end** (125), **padding** (0),
   and **base price**.
3. Up to 500 units can be created per batch.

### Bulk import (Excel / CSV)
1. Click **Download template** — you get a `.xlsx` scoped to your project
   type with the right columns.
2. Fill it in, save.
3. Upload via **Import units**.
4. You'll see a **per-row error report** so you know exactly which rows
   failed validation.

### Unit actions
- **Sell** — records buyer name, price, sold date.
- **Reserve** — buyer + expiry date; can be manually released later.
- **Release** — cancels a reservation.
- **Cancel** — marks a sold unit as cancelled (rare, auditable).

Filter units by **status** (available, sold, reserved, cancelled).

---

## Revenue & Payments

### Record a payment
**Revenue** → **New Payment** → select unit → amount, mode (bank/cash/UPI/cheque),
paid-on date. Payments contribute to **received** revenue.

### Revenue Summary
Three numbers per project (and rolled up):
- **Accrued** = sum of prices of sold units.
- **Received** = sum of recorded payments.
- **Receivable** = accrued − received.

Charts break this down monthly and by project.

---

## Revenue Targets & Variance

Admins / Accounts can set targets per project:
1. Go to **Revenue** → **Targets** tab.
2. Click **Add target**.
3. Choose **period type** (monthly / quarterly), **period key** (e.g.
   `2026-02` or `2026-Q1`), amount.
4. Save.

The **variance tile** on the dashboard shows actual vs target and the % gap
(green if ≥ target, amber if 80–99 %, red if < 80 %).

---

## Expenses (2-Stage Approval)

### Raise an expense
Anyone (site manager and above) can raise. Fields: project, category,
vendor, amount, date, description, receipt file (image or PDF).

### Approval flow
```
Site Manager raises  →  Accounts stage-1 approves  →  Management final approves
                     ↘ Accounts rejects (with reason)
                                                    ↘ Management rejects (with reason)
```

- **Threshold:** expenses **above** the threshold in Settings require
  Management's final approval. Below-threshold expenses close after stage-1.
- **Rejection:** both stages allow rejection with a mandatory reason;
  reason is shown in the audit trail.

### Receipts
Uploaded to Emergent Object Storage. Click the paperclip icon on any
expense row to download the receipt.

---

## Stock Book

Track site materials per project.

- **Add item** — name, unit (bag / ton / piece / m³), opening quantity.
- **Record movement** — inward (delivery) or outward (consumption), with
  date + note.
- **Closing = opening + inward − outward** (auto-computed, always visible).

Site managers can only edit stock in **their assigned projects**.

---

## Users & Invites

Admin only.

### Invite a user
1. **Users** → **Invite**.
2. Enter email, name, phone (optional), role, and (for site managers)
   which projects they can access.
3. A **12-char secure temp password** is generated automatically.
4. An **invite email** is sent from your Google Workspace SMTP account with
   the temp password + login URL.
5. If SMTP is not configured, the UI shows you the temp password with a
   copy button so you can share it manually.

### Reset a user's password
`Users` → row menu → **Reset password**. Generates a new temp password and
optionally emails it. User will be forced to reset again on next login.

### Deactivate a user
`Users` → row menu → **Deactivate**. They can no longer log in but their
history is preserved.

---

## Settings & Branding

Admin only (**Settings** page).

- **Company name, currency (INR default), threshold amount** for expense
  final approval.
- **Company logo upload** — shows on the sidebar, login screen (via public
  branding endpoint), and PDF exports.
- **SMTP status** — read-only indicator; SMTP creds live in the backend
  `.env`.

---

## Notifications

- Bell icon on the top nav.
- Polling every ~30 s (in-app only, no push email yet).
- Notification types: expense awaiting your approval, expense rejected,
  user invited, project created.

---

## Global Search

- Press `⌘K` (Mac) or `Ctrl+K` (Windows/Linux), or click the search bar in
  the sidebar.
- Type across projects, units, payments, expenses, users.
- Enter to jump to the record.

---

## Exports (Excel & PDF)

On any of these tables — **Units, Expenses, Payments, Stock Book** — you'll
see two buttons at the top-right:

- **Export Excel** — server-side `.xlsx` with all current filters applied.
- **Export PDF** — client-side PDF with the same rows, ready to print /
  share.

---

## Quick-Share as JPG

Any dashboard card / chart has a small **share icon** (top-right corner
of the card):

- **Download PNG** — saves a snapshot to your device.
- **Share** — on supported browsers (mobile), opens the native share sheet.

Great for pasting a KPI into a WhatsApp / Slack conversation without
sharing login credentials.

---

## Audit Log

Every mutating action is logged:
- Actor (user + role)
- Action (`user.invite`, `project.create`, `expense.approve.stage1`, …)
- Entity type + id
- Timestamp
- Metadata (before/after where relevant)

`Audit Log` page (admin / accounts / management) with filters by actor,
entity, and date range.

---

## FAQ

**Q. I lost my password.**
Ask your admin to click **Reset password** on your user row. You'll get a
new temp password by email.

**Q. Why can't I see a project?**
You're a site manager and haven't been assigned that project. Ask your
admin.

**Q. An invite email didn't arrive.**
Check spam. If still missing, ask your admin — they can copy the temp
password from the Users page if SMTP is set up, or use **Reset password**
to regenerate.

**Q. Why is my expense still pending?**
It's over the threshold and is waiting on **Management** final approval.
You'll get a bell notification when they act on it.

**Q. Can two site managers work on the same project?**
Yes. Assign both to the same project. Both can add / edit units, raise
expenses, and update stock for that project.

**Q. Where's my data stored?**
MongoDB (managed by Emergent) and Emergent Object Storage for files.
Preview and production have **separate databases** — moving to
production requires a fresh admin seed.
