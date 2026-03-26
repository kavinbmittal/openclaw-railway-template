# Dashboard Briefing — Replaces Inbox

## What This Means for Users

When you open Mission Control, you see a priority-ordered briefing instead of a category-sorted inbox. The most important things — decisions blocking your agents — are at the top and visually dominant. Risks are next. What happened since you last looked is at the bottom, quieter. You always know what to look at first, second, third.

The Inbox page is gone. The Briefing replaces it at the same route. The Overview page is untouched.

---

## Problem

The current Inbox organizes items by type (approvals, budget, stale tasks, standups, experiments). Every section has equal visual weight. When you open it, you don't know what to look at first — a standup and a critical budget alert compete for the same attention.

## Approach

Replace the Inbox with a Briefing page. Same route (`#/inbox` kept as alias), same API endpoint (`/mc/api/inbox`). The data is identical — only the frontend organization and visual hierarchy change, plus two new item types from the backend.

---

## Three Sections

### Section 1 — Decisions Waiting on You (action required)

**Contains:** Pending approvals (`approval`), proposed issues (`proposed_issue`), budget alerts (`budget` — both critical and warning).

**Visual treatment:** Elevated card with `border-l-2` accent. Red left border if any item has `severity === "critical"`, amber otherwise. This is the only elevated card on the page — the `border-l-2` pattern from DESIGN.md says "max one per view."

**Empty state:** Emerald checkmark — "No decisions waiting. System stable, agents running." This is the payoff: you open Mission Control and immediately see green.

**Click behavior:** Approvals/proposed → ApprovalDetail. Budget → project costs tab. Same as current Inbox.

### Section 2 — Risks (awareness required)

**Contains:** Stale tasks (`stale_task`), overdue issues (`overdue_issue` — NEW), paused experiments (`paused_experiment` — NEW).

**Visual treatment:** Standard card with amber tinted header. No left border accent — visually present but subordinate to Section 1.

**Hidden when empty.** No empty state card. Absence = no risks.

**Click behavior:** Stale tasks → issue detail. Overdue issues → issue detail. Paused experiments → experiment detail.

### Section 3 — What Happened (context)

**Contains:** Standups (`standup`), experiment updates (`experiment_update`).

**Visual treatment:** Standard card with neutral tinted header. Row text uses `text-muted-foreground` instead of `text-foreground` — the entire section is visually quieter.

**Hidden when empty.** No empty state card.

**Click behavior:** Standups → project standups tab. Experiment updates → experiment detail. Same as current Inbox.

---

## Scope

### In scope
- New `Briefing.jsx` page replacing `Inbox.jsx`
- Three priority-ordered sections with visual weight hierarchy
- Two new item types in `/mc/api/inbox`: `overdue_issue`, `paused_experiment`
- Updated counts object with new types
- Sidebar: rename "Inbox" → "Briefing", update badge to count Sections 1+2 only
- App.jsx: swap route, keep `#/inbox` as alias for `#/briefing`
- Overview.jsx: update banner click target

### Out of scope
- "Last seen" / time-based awareness (deferred — add later if static view isn't enough)
- Inline approve/reject actions on the Briefing (click through to detail pages for now)
- "On Track" section (cut — absence of problems is the confidence signal at current scale)
- Overview page changes (beyond updating the navigation target)
- Default landing page change (Briefing does NOT become the default — Overview stays default)

---

## Backend Changes — `/mc/api/inbox`

### New item type: `overdue_issue`

Added to the existing issues scan loop (section C). For issues where `status` is not `done`/`cancelled`/`proposed` and `target_date` exists and is before today:

```json
{
  "type": "overdue_issue",
  "project": "proj-name",
  "id": "issue-id",
  "title": "Issue title",
  "assignee": "agent-name",
  "target_date": "2026-03-20",
  "days_overdue": 6,
  "timestamp": "2026-03-20T00:00:00Z"
}
```

**Implementation note:** This goes in the existing issues scan loop (section C, around line 2590). After the stale task check, add an overdue check. An issue can be BOTH stale and overdue — that's fine, it appears in both.

### New item type: `paused_experiment`

Scan each project's experiments directory. For each experiment, derive status using the existing `deriveStatusFromResults()` function. If status is `paused`:

```json
{
  "type": "paused_experiment",
  "project": "proj-name",
  "id": "experiment-dir",
  "title": "Experiment name",
  "experiment_dir": "experiment-dir",
  "timestamp": "2026-03-25T00:00:00Z"
}
```

**Implementation note:** This is a new scan loop (section G) after the experiment updates scan. It reads each experiment's `program.md` for the name and `results.tsv` for status derivation, reusing `deriveStatusFromResults()` which already exists in server.js.

### Updated counts object

```json
{
  "approvals": 2,
  "budget": 1,
  "tasks": 1,
  "proposed": 1,
  "standups": 2,
  "updates": 1,
  "overdue": 1,
  "paused": 0,
  "total": 9
}
```

### No breaking changes
Existing count fields stay. The Overview page reads `approvals + budget + tasks` — unaffected.

---

## Frontend Changes

### `Briefing.jsx` (new file, replaces `Inbox.jsx`)

Calls `getInbox()` — same API endpoint. Groups items into three sections:

| Section | Filter | Item types |
|---------|--------|------------|
| S1 Decisions | `approval`, `proposed_issue`, `budget` | Approvals, proposed issues, budget alerts |
| S2 Risks | `stale_task`, `overdue_issue`, `paused_experiment` | Stale tasks, overdue issues, paused experiments |
| S3 What Happened | `standup`, `experiment_update` | Standups, experiment decisions |

**Section 1 visual:**
- Card: `bg-card border border-border rounded-[2px] shadow-sm border-l-2 border-l-{color} bg-accent/20`
- Left border color: `border-l-red-500` if any budget item has `severity === "critical"`, else `border-l-amber-500`
- If empty: emerald checkmark empty state (same pattern as current Inbox approvals empty state)

**Section 2 visual:**
- Standard card with amber tinted header (AlertTriangle icon)
- Hidden when empty

**Section 3 visual:**
- Standard card with muted tinted header (indigo — Activity icon)
- Row text: `text-muted-foreground` instead of `text-foreground`
- Hidden when empty

**Badge rows for new types:**
- `overdue_issue`: red badge — "Overdue · {days}d", links to issue detail
- `paused_experiment`: orange badge — "Paused", links to experiment detail

**Page header:** "Briefing" — same `text-[16px] font-semibold uppercase tracking-[0.2em]` as current "Inbox" header.

**Subtitle:** `{n} items need your attention` where n = S1 + S2 count.

### `Sidebar.jsx`

- Rename label: "Inbox" → "Briefing"
- Keep `Inbox` lucide icon (still semantically correct — it's where things arrive)
- Badge count: `approvals + proposed + budget + tasks + overdue + paused` (Sections 1+2 only)
- Navigate: `"inbox"` → `"briefing"`

### `App.jsx`

- Replace `import Inbox` with `import Briefing`
- Hash parser: `case "briefing"` returns `{ page: "briefing" }`. Keep `case "inbox"` as alias → `{ page: "briefing" }`
- Render: `page === "briefing" && <Briefing navigate={navigate} />`

### `Overview.jsx`

- Banner click: `navigate("inbox")` → `navigate("briefing")`

### Delete `Inbox.jsx`

---

## Badge Count — Decision Record

**Briefing sidebar badge = Sections 1 + 2:**
`approvals + proposed + budget + tasks + overdue + paused`

**Rationale:** Section 3 (standups, experiment updates) is informational — it shouldn't trigger a badge. You check it when you're already on the Briefing, not because a badge pulled you there.

This differs from the current Inbox badge which includes `updates`. The new count is the correct one — it matches "things that need your attention or awareness."

---

## Key Decisions

| Decision | Chosen | Rejected | Why |
|----------|--------|----------|-----|
| Replace Inbox vs. add new page | Replace | Add alongside | One "what needs me" surface, not two. Eliminates "where do I go" decision |
| 3 sections vs. 4 | 3 sections | 4 (with "On Track") | At 3-4 projects, absence of problems IS the confidence signal. Cut complexity |
| Inline actions vs. click-through | Click-through to detail pages | Inline approve/reject | Simpler to build, detail pages already work well. Add inline later if friction is real |
| Badge scope | Sections 1+2 only | All sections | Informational items shouldn't pull you to the Briefing |
| Visual hierarchy | Elevated → standard → muted | Equal weight (current Inbox) | Core insight: constrain visual weight to route attention |
| Default landing page | Overview stays default | Briefing as default | Overview is the status board, Briefing is the action board — different jobs |
| Route | Keep `#/inbox` as alias for `#/briefing` | Break old route | No reason to break bookmarks |
