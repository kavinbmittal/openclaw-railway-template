# Blocked on Operator + Project-Grouped Briefing

## What This Means for Users

When an agent is stuck waiting on you, it shows up right at the top of the Briefing — you see which project, which agent, and exactly what they need, without clicking into anything. The entire Briefing is now grouped by project so you can scan one project at a time instead of a flat mixed list. Agents clear the blocker automatically when they detect you've addressed it.

---

## Problem

Agents get blocked waiting on operator input (API keys, decisions, feedback, direction). Today, that information is buried in standup prose. It doesn't surface in the Briefing, so blocked agents sit idle until you happen to read the right standup.

## Approach

### 1. Structured blocker on issues

Agents set three fields on an issue JSON when they need operator input:

- `blocked_on: "operator"` — who they're waiting on
- `blocked_reason: "short description of what they need"` — visible in the Briefing row
- `blocked_at: "ISO timestamp"` — when they got stuck, used for sorting (oldest first)

Agent clears all three fields on next heartbeat when the situation is resolved (operator commented, approved, provided what was needed). No dashboard dismiss button — the agent figures it out.

### 2. New item type in `/mc/api/inbox`

The inbox endpoint scans issues and emits `blocked_on_operator` items for any issue with `blocked_on === "operator"`:

```json
{
  "type": "blocked_on_operator",
  "project": "lia",
  "id": "issue-id",
  "title": "Issue title",
  "blocked_reason": "Need API key for Stripe integration",
  "blocked_at": "2026-03-26T10:00:00Z",
  "assignee": "agent-lia",
  "days_blocked": 1,
  "timestamp": "2026-03-26T10:00:00Z"
}
```

This goes into Section 1 (Decisions Waiting) — it's blocking an agent, so it needs action.

### 3. Project-grouped Briefing

All three Briefing sections group items by project. Within each section:

- Project sub-headers with project name and item count
- Projects sorted by urgency: project with oldest/most critical item first
- Items within a project sorted by age (oldest first)
- Items with no project (edge case) grouped under a "General" fallback

Visual structure per section:

```
Section Header                                    total

  Project Name                                    count
    icon  badge  title            agent    time
    icon  badge  title            agent    time

  Project Name                                    count
    icon  badge  title            agent    time
```

Project sub-headers are lightweight — project name in `text-[13px] font-mono uppercase tracking-[0.1em] text-muted-foreground` with a subtle top border between groups. Not a card-within-a-card — just a visual grouping line.

### 4. Blocker row in Briefing

The `blocked_on_operator` item renders with:

- Icon: `UserCheck` (or `Hand`) — distinct from approval/budget icons
- Badge: orange — "Waiting · {days}d" (or "Waiting · {hours}h" if < 1 day)
- Title: the issue title
- Second line or inline: `blocked_reason` in muted text — "Need API key for Stripe"
- Right side: agent name + time since blocked
- Click: navigates to issue detail

---

## Scope

### In scope
- `blocked_on`, `blocked_reason`, `blocked_at` fields on issue JSON
- New `blocked_on_operator` item type in inbox API + counts
- Project grouping across all three Briefing sections
- Blocker row rendering with reason visible inline
- Badge count updated: blockers count toward Section 1
- Protocol update: agents learn to set/clear blocker fields

### Out of scope
- Dashboard "unblock" button (agent auto-clears on heartbeat)
- Blocking on other agents (only `operator` for now)
- Blocker reason editing from the dashboard
- Notifications/alerts when a blocker is set (Briefing is the surface)

---

## Key Decisions

| Decision | Chosen | Rejected | Why |
|----------|--------|----------|-----|
| Agent clears blocker vs. operator dismisses | Agent clears on heartbeat | Dashboard dismiss button | Operator shouldn't click a button AND do the thing — agent detects the change |
| Blocker in Section 1 vs Section 2 | Section 1 (Decisions) | Section 2 (Risks) | It's blocking an agent from working — that's a decision waiting, not a risk |
| Project grouping scope | All three sections | Only Section 1 | Inconsistent grouping feels broken — do it once everywhere |
| Blocker reason visible inline | Yes, on the row | Only on click-through | The whole point is triage at a glance without clicking into every issue |
| Sort within project | Oldest first | Newest first | Longest-waiting agent gets attention first |
| Project sort within section | Most urgent first | Alphabetical | Project with the oldest/most critical item bubbles to top |
