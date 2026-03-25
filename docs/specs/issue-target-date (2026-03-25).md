# Issue Target Date

## What This Means for Users

Issues now have a target date. Agents propose one when creating an issue, and Kavin can override it from the dashboard. On the issues list and detail page, the date shows as friendly relative text — "in 3 days", "tomorrow", "overdue" — color-coded by urgency so you can scan what needs attention without thinking.

## Problem

Issues have priority (how important) but not urgency (when). A medium-priority issue due tomorrow is more urgent than a high-priority issue due next month. There's no way for agents or Kavin to express "this needs to happen by Friday" — and no way to see at a glance what's late.

## Approach

Add a `target_date` field to the issue JSON. Surface it in create, edit, and detail flows. Show it as relative text on issue list rows with color-coded urgency.

### Data

- **Field:** `target_date` — ISO date string (e.g. `"2026-04-01"`), nullable, optional
- **Stored in:** issue JSON files (`/shared/projects/{slug}/issues/{id}.json`)
- **Set by:** agents on creation, editable by Kavin from dashboard (create + edit forms)
- **Default:** `null` (no target date)

### Display — Relative Text

A utility function computes friendly display text from the target date:

| Condition | Text | Color |
|-----------|------|-------|
| Past due | "overdue" | `text-red-400` |
| Today | "today" | `text-amber-400` |
| Tomorrow | "tomorrow" | `text-amber-400` |
| 2–7 days | "in X days" | `text-muted-foreground` |
| 8–30 days | "in X days" | `text-muted-foreground` |
| 31+ days | "Mon DD" (e.g. "Apr 15") | `text-muted-foreground` |
| No date | nothing shown | — |

No badge or pill — just colored inline text. Keeps density tight.

### Surfaces

1. **Create Issue form** — date input field, optional. Label: "TARGET DATE". Uses the standard form micro-label style (`text-[11px] uppercase font-mono tracking-[0.15em]`). Native date picker input with same styling as other form inputs.

2. **Edit Issue form** — same date input, pre-filled if set. Clearable.

3. **Issue Detail page** — show target date in the metadata line under the title (alongside created date, assignee, etc.). Uses relative text with urgency color.

4. **Issue list rows** — new column or inline text showing the relative date with urgency color. Positioned after priority or status, before assignee.

### API

- **POST /mc/api/issues** — accepts optional `target_date` in body
- **PATCH /mc/api/issues/{id}** — accepts optional `target_date` in body (set to `null` to clear)
- **GET responses** — return `target_date` as-is (ISO string or null)

No server-side validation beyond checking it's a valid date string or null. The relative text computation happens client-side.

## What's Explicitly Out of Scope

- Sort/filter by target date (follow-up)
- Unified "needs attention" view across issues + experiments (follow-up, needs experiment review dates too)
- Overdue notifications or escalation
- Experiment `next_review_date` (separate spec)

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| ISO date string, not datetime | Target dates are day-granularity. No timezone complexity. |
| Nullable, not required | Not every issue needs a deadline. Agents propose when relevant. |
| Client-side relative text | Avoids server recomputation. Date math is trivial in the browser. |
| Color-coded text, not badges | Matches dashboard density. Badges would add visual noise to rows. |
| Amber for today/tomorrow, red for overdue | Matches existing semantic color system in DESIGN.md. |
