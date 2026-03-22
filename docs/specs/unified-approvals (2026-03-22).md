# Unified Approvals — Decision Command Center

## What This Means for Users

Everything that needs Kavin's sign-off — proposed issues, experiment gates, deliverable reviews — shows up in one place. No more hunting across project tabs to find what needs attention. The Approvals page (both global and per-project) becomes the single surface for all pending decisions, grouped by project, newest first within each group. The sidebar badge reflects the true count. Proposed issues disappear from the Issues tab — they live exclusively in Approvals until approved, at which point they become `todo` items that agents pick up on their next 15-minute heartbeat.

---

## Problem

Two separate systems handle "things needing sign-off" with no awareness of each other:

1. **Proposed issues** — agents create issues with `status: "proposed"`. These only appear as a small violet banner inside a specific project's Issues tab. There's no global view.
2. **Approval gates** — agents write files to `approvals/pending/`. These appear on the global Approvals page and the per-project Approvals tab.

The result: the Approvals page often looks empty even when there are proposed issues waiting. The sidebar badge undercounts. Users have to check every project's Issues tab to find proposed work.

---

## Approach

Unify both data sources into the existing Approvals surface. No new pages, no new navigation — just make the Approvals page and per-project Approvals tab show everything.

### Why this approach over alternatives

- **Alternative: Move approvals into Issues** — Rejected. Issues and approval gates are fundamentally different things (discrete tasks vs. autonomous loop permissions). Forcing them into one data model creates confusion.
- **Alternative: New "Decisions" page** — Rejected. Adds navigation complexity. The Approvals page already exists and has the right intent — it just needs to show more.

---

## Scope

### In scope
- Backend: `GET /mc/api/approvals` returns both gate requests AND proposed issues, with a `type` field distinguishing them
- Global Approvals page: shows all pending items grouped by project, newest first within each group
- Per-project Approvals tab: same view, filtered to that project
- Issues tab: drops the proposed-issue banner entirely — proposed items only live in Approvals
- Sidebar badge: counts from the unified endpoint
- Per-project Approvals tab badge: counts both types for that project
- Click into a proposed issue from Approvals to see full detail and approve/reject
- Click into a gate request from Approvals (existing behavior, preserved)

### Out of scope
- Keyboard shortcuts / bulk actions
- Priority/urgency sorting (beyond newest-first within project)
- Linking a gate request to a related issue
- Changes to how agents create proposals or gates (backend write paths unchanged)
- Notification/inbox changes (inbox already counts proposed issues separately — leave as-is for now)

---

## Architecture

### Backend change: `GET /mc/api/approvals`

Currently scans `approvals/pending/` directories only. Expand to also scan `issues/*.json` across all projects for `status: "proposed"`.

Each item in the response gets a unified shape:

```
{
  id:        string,           // gate ID or issue ID (e.g. "LIA-003")
  type:      string,           // "proposed-issue" | "experiment-start" | "autoresearch-start" | "deliverable-review"
  project:   string,           // project slug
  title:     string,           // issue title or gate "what" field
  body:      string,           // issue description or gate "why" field
  requester: string,           // agent name or issue created_by
  created:   string,           // ISO timestamp
  status:    string,           // "pending" or "proposed"
  priority:  string | null,    // only for proposed issues
  _source:   "issue" | "gate", // internal: tells the frontend which resolve path to use
}
```

When `project` query param is provided, filter to that project only (used by per-project tab).

### Backend change: `GET /mc/api/approvals/:id`

Currently searches only `approvals/pending/`, `approvals/resolved/`, and `output/index.json`. Expand to also search `issues/*.json` across projects for a matching issue ID. When found, return the issue data mapped to the unified shape (with `_source: "issue"`, `type: "proposed-issue"`, full description as `why`, title as `what`).

### Frontend changes

**Approvals.jsx (global page)**
- Fetches from unified `GET /mc/api/approvals`
- Groups items by `project`, sorts groups alphabetically
- Within each group, sorts by `created` descending (newest first)
- Each item renders with a type badge ("Issue" / "Experiment" / "Deliverable")
- Click navigates to `#/approvals/{id}` for all item types — proposed issues render their detail on ApprovalDetail, not IssueDetail (keeps user in Approvals flow, avoids broken back-navigation)
- Approve/reject actions:
  - For `_source: "gate"`: existing `resolveApproval` flow
  - For `_source: "issue"`: PATCH issue status to `todo` (approve) or DELETE issue (reject)

**ProjectDetail.jsx — Approvals tab**
- Fetches from `GET /mc/api/approvals?project={slug}` (unified, includes proposed issues)
- Same rendering as global page but without project grouping (single project)
- Badge on the tab counts all pending items (both types)

**ProjectDetail.jsx — Issues tab badge**
- Currently no badge. Add one showing count of active issues (non-proposed) so it's still useful.

**Issues.jsx**
- Remove the proposed-issues banner (violet section at top)
- Remove `handleApproveProposal` and `handleRejectProposal` functions
- `activeIssues` filter stays but `proposedIssues` split is removed
- Only shows issues with status backlog through cancelled

**Sidebar.jsx**
- Badge on "Approvals" nav item counts from the unified endpoint (gates + proposed issues)

**ApprovalCard.jsx**
- Add support for rendering proposed issues: show type badge, priority if present, requester
- Approve button: for issues, calls `updateIssue(id, project, { status: "todo" })`; for gates, calls existing `resolveApproval`

---

## Data flows

### Happy path — proposed issue
```
Agent creates issue (status: proposed)
  → GET /mc/api/approvals returns it with type: "proposed-issue"
  → Approvals page renders it in the project's group
  → Kavin clicks Approve
  → PATCH /mc/api/issues/:id → status: "todo"
  → Next agent heartbeat (15 min) picks it up
```

### Happy path — experiment gate
```
Agent writes approvals/pending/{id}.json
  → GET /mc/api/approvals returns it with type: "experiment-start"
  → Approvals page renders it in the project's group
  → Kavin clicks Approve
  → resolveApproval writes resolved file + tombstone + notification
  → Agent detects approval and starts experiment
```

### Reject — proposed issue
```
Kavin clicks Reject on proposed issue
  → DELETE /mc/api/files (removes issue JSON)
  → Item disappears from Approvals
```

### Reject — gate request
```
Kavin clicks Reject on gate (comment required)
  → resolveApproval writes resolved file with decision: "rejected"
  → Agent reads rejection and stops
```

### Empty state
```
No pending gates AND no proposed issues
  → "All clear — nothing needs your approval"
```

---

## Error handling

- If the issues scan fails for a project (missing directory, corrupt JSON), skip that project silently — don't block gate requests from loading
- If a proposed issue is approved but the PATCH fails, show an error toast and keep the item in the list (don't optimistically remove it)
- If `GET /mc/api/approvals` itself fails, show error state with retry button (existing pattern)

---

## Key decisions

| Decision | Choice | Alternative rejected | Why |
|----------|--------|---------------------|-----|
| Unify into Approvals, not into Issues | Approvals page shows both | Could have added gates to Issues page | Issues are tasks with lifecycle; gates are permission requests. Approvals is the right mental model for "needs my decision" |
| Group by project, not by type | Project-first grouping | Could group by type (all issues, then all gates) | Kavin thinks in projects, not in approval types. Project context makes each decision easier |
| Remove proposed banner from Issues | Proposed items exclusively in Approvals | Could show in both places | Two places = confusion about where to act. Single source of truth for pending decisions |
| Backend unification (not frontend-only) | Single endpoint returns both | Frontend could call two endpoints and merge | Single endpoint is simpler, enables correct badge counts, and keeps the frontend dumb |

---

## Testing plan

- Verify `GET /mc/api/approvals` returns both proposed issues and gate requests with correct `type` field
- Verify `?project=` filter works for per-project tab
- Verify approving a proposed issue moves it to `todo` and it disappears from Approvals
- Verify rejecting a proposed issue deletes it
- Verify approving/rejecting gates still works (no regression)
- Verify Issues tab no longer shows proposed items
- Verify sidebar badge counts both types
- Verify per-project Approvals tab badge counts both types
- Verify empty state when no pending items of either type
- Verify corrupt/missing issue files don't break the endpoint
