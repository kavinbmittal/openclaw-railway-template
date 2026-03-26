# Test Plan — Blocked on Operator + Project-Grouped Briefing

## Unit Tests

### Backend — `blocked_on_operator` item type

- Issue with `blocked_on: "operator"` + status `in_progress` → emits `blocked_on_operator` item
- Issue with `blocked_on: "operator"` + status `todo` → emits `blocked_on_operator` item
- Issue with `blocked_on: "operator"` + status `done` → does NOT emit (closed issue)
- Issue with `blocked_on: "operator"` + status `cancelled` → does NOT emit
- Issue with no `blocked_on` field → does NOT emit blocker item
- Issue with `blocked_on: "other-agent"` → does NOT emit (only `operator` supported)
- `blocked_reason` missing → item still emitted, reason falls back to "Waiting on input"
- `blocked_at` missing → item still emitted, timestamp falls back to issue `updated` date
- `days_blocked` computed correctly from `blocked_at`
- `blocked` count added to counts object
- `total` includes blocked count

### Frontend — project grouping

- Items from 3 different projects → 3 project sub-headers in correct order
- Items from 1 project → 1 sub-header, no "General" fallback
- Items with no project field → grouped under "General"
- Projects sorted by urgency: project with oldest item appears first
- Items within a project sorted by age (oldest first)
- Empty section → hidden entirely (no project groups rendered)
- Grouping applies to all three sections (Decisions, Risks, What Happened)

### Frontend — blocker row rendering

- `blocked_on_operator` item renders with orange "Waiting" badge
- Badge shows hours if < 1 day: "Waiting · 3h"
- Badge shows days if >= 1 day: "Waiting · 2d"
- `blocked_reason` visible inline on the row in muted text
- Missing `blocked_reason` shows "Waiting on input" fallback
- Agent name shown on right side
- Click navigates to issue detail

### Frontend — badge count

- Sidebar badge includes `blocked` count (Section 1 item)
- Badge = approvals + proposed + budget + tasks + overdue + paused + blocked

## Integration Tests

### Full flow

- Create issue with `blocked_on: "operator"`, `blocked_reason: "Need API key"`, `blocked_at: timestamp`
- Call `GET /mc/api/inbox` → verify `blocked_on_operator` item in response with correct fields
- Load Briefing → verify item appears in Section 1 under correct project group
- Clear `blocked_on` fields (PATCH with nulls) → call inbox again → item gone

### Project grouping across sections

- Create items across 2 projects: 1 approval (project A), 1 budget alert (project B), 1 stale task (project A), 1 standup (project B)
- Load Briefing → Section 1 shows project A group + project B group; Section 2 shows project A group; Section 3 shows project B group

## Manual Checks

### Visual hierarchy with project groups
- [ ] Project sub-headers are lightweight — not competing with section headers
- [ ] Sub-header uses mono font, uppercase, muted color
- [ ] Subtle top border separates project groups
- [ ] Items within a group are indented or visually nested under the sub-header
- [ ] Single-project sections don't look odd (still shows project name)

### Blocker row
- [ ] Orange badge visually distinct from approval (amber) and budget (red) badges
- [ ] Blocked reason text readable but clearly secondary to the issue title
- [ ] Agent name visible without truncation on typical screen widths

### All-clear state
- [ ] No blockers + no other items → Section 1 shows emerald checkmark (unchanged)
- [ ] Sidebar badge = 0 when no items

## Regression Risk

### What could break
- **Existing Briefing rows:** Project grouping changes the DOM structure. All existing click handlers and navigation must still work within the new grouped layout.
- **Sidebar badge:** Adding `blocked` to the count. Verify badge doesn't double-count items that are both blocked and stale.
- **Empty states:** Section 1 empty state must still render correctly within the project-grouped structure.

### How to verify
- Click every item type in every section → correct navigation target
- Compare sidebar badge with manual count of S1+S2 items
- Test with zero items → green checkmark renders
- Test with items from only one project → no visual weirdness
