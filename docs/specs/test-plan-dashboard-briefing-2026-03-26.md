# Test Plan — Dashboard Briefing

## Unit Tests

### Backend — `/mc/api/inbox` new item types

**`overdue_issue` items:**
- Issue with `target_date` before today + status `in_progress` → appears as `overdue_issue`
- Issue with `target_date` before today + status `done` → does NOT appear
- Issue with `target_date` before today + status `cancelled` → does NOT appear
- Issue with `target_date` before today + status `proposed` → does NOT appear
- Issue with no `target_date` → does NOT appear as overdue (may still appear as stale)
- Issue with `target_date` === today → does NOT appear (not overdue yet)
- Issue with `target_date` tomorrow → does NOT appear
- `days_overdue` computed correctly (target_date was 3 days ago → `days_overdue: 3`)
- Issue that is BOTH stale (>3d idle) AND overdue → appears as both `stale_task` and `overdue_issue`

**`paused_experiment` items:**
- Experiment with `pause` as latest decision in results.tsv → appears as `paused_experiment`
- Experiment with `scale` as latest decision → does NOT appear
- Experiment with no results.tsv → does NOT appear
- Experiment with `pause` followed by `pivot` → does NOT appear (pivot is latest)

**Counts object:**
- `overdue` count matches number of `overdue_issue` items
- `paused` count matches number of `paused_experiment` items
- `total` includes all item types
- Existing counts (`approvals`, `budget`, `tasks`, `standups`, `proposed`, `updates`) unchanged

### Frontend — Briefing.jsx section grouping

- Items with type `approval`, `proposed_issue`, `budget` → Section 1 (Decisions)
- Items with type `stale_task`, `overdue_issue`, `paused_experiment` → Section 2 (Risks)
- Items with type `standup`, `experiment_update` → Section 3 (What Happened)
- No item appears in more than one section
- Unknown item types are silently ignored (don't crash)

### Frontend — Section 1 border color logic

- All items are approvals (no critical budget) → amber left border
- One budget item with `severity: "critical"` → red left border
- Mix of approvals + warning budget → amber left border
- Empty section → emerald checkmark empty state, no left border

### Frontend — Badge count

- Sidebar badge = sum of S1 + S2 item counts
- Standups and experiment_updates excluded from badge
- Zero items → no badge shown

## Integration Tests

### Full API → Frontend flow

- Create test project with: 1 pending approval, 1 overdue issue, 1 stale task, 1 standup, 1 paused experiment
- Call `GET /mc/api/inbox` → verify all 5 items returned with correct types
- Load Briefing page → verify Section 1 has approval, Section 2 has overdue + stale + paused, Section 3 has standup

### Navigation

- Click approval row → navigates to `#/approvals/{id}`
- Click budget row → navigates to `#/projects/{slug}/costs`
- Click stale task row → navigates to `#/projects/{slug}/issues/{id}`
- Click overdue issue row → navigates to `#/projects/{slug}/issues/{id}`
- Click paused experiment row → navigates to `#/projects/{slug}/experiments/{dir}`
- Click standup row → navigates to `#/projects/{slug}/standups`
- Click experiment update row → navigates to `#/projects/{slug}/experiments/{dir}`

### Route handling

- `#/briefing` → renders Briefing page
- `#/inbox` → renders Briefing page (alias)
- Sidebar "Briefing" nav item highlighted when on `#/briefing`
- Sidebar "Briefing" nav item highlighted when on `#/inbox` (alias)

## Manual Checks

### Visual hierarchy verification
- [ ] Section 1 card is visually dominant (left border accent, slightly elevated feel)
- [ ] Section 2 card is clearly subordinate to Section 1 (no left border, standard weight)
- [ ] Section 3 card rows are noticeably muted compared to Section 1 and 2 rows
- [ ] Empty Section 1 shows emerald checkmark — this should feel like the "payoff" state
- [ ] Empty Sections 2 and 3 are completely hidden (no card, no header, nothing)

### All-clear state
- [ ] When no items in any section: page shows only Section 1 empty state
- [ ] Sidebar badge shows 0 (hidden)

### Busy state
- [ ] When all sections have items: page shows three cards in correct order
- [ ] Visual weight clearly decreases top to bottom
- [ ] Badge count matches S1 + S2 total

### Design system compliance
- [ ] Tinted card headers follow DESIGN.md pattern (icon circle + tinted bg + colored title)
- [ ] Badge colors match DESIGN.md semantic badge colors
- [ ] Spacing follows `space-y-6` between sections
- [ ] Page header matches `text-[16px] font-semibold uppercase tracking-[0.2em]`
- [ ] No `rounded-lg` anywhere
- [ ] Row hover states use `hover:bg-accent/40`

## Regression Risk

### What could break
- **Overview banner:** Currently links to `navigate("inbox")`. Must update to `navigate("briefing")` or the alias must work.
- **Sidebar badge count:** Changing from `approvals + budget + tasks + proposed + updates` to `approvals + proposed + budget + tasks + overdue + paused`. The badge may show a different number than before (likely lower since it drops `updates`, but adds `overdue` + `paused`).
- **Approvals page:** Completely separate from this change. Should be unaffected — verify it still loads and shows correct data.
- **Deep links from external sources:** If anything links to `#/inbox`, the alias ensures it still works.

### How to verify
- Load Overview → click "needs attention" banner → lands on Briefing
- Check sidebar badge count against manual count of S1+S2 items
- Load `#/approvals` → still works, correct data
- Load `#/inbox` directly → renders Briefing page
