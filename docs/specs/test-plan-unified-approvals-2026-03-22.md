# Test Plan — Unified Approvals

## Unit tests

### Backend: `GET /mc/api/approvals`
- Returns gate requests from `approvals/pending/` with `_source: "gate"` and correct `type`
- Returns proposed issues from `issues/*.json` with `_source: "issue"` and `type: "proposed-issue"`
- Returns deliverables from `output/index.json` with `_source: "gate"` and `type: "deliverable-review"`
- Skips tombstone files in `approvals/pending/`
- Skips issues with status other than "proposed"
- `?project=slug` filters to that project only
- Corrupt/missing issue JSON files don't break the response (other items still returned)
- Empty state: no projects directory → returns `{ approvals: [] }`

### Backend: `GET /mc/api/approvals/:id`
- Returns gate detail by ID (existing behavior preserved)
- Returns proposed issue detail by issue ID (e.g. "LIA-003") with `_source: "issue"`
- Returns 404 for non-existent ID
- Tombstone redirect still works for resolved gates

### Frontend: ApprovalCard
- Renders proposed issues with "Issue" type badge
- Renders gate requests with gate name badge (existing)
- Approve button calls `updateIssue` for `_source: "issue"`
- Approve button calls `resolveApproval` for `_source: "gate"`
- Reject button calls `deleteIssue` for `_source: "issue"`
- Reject button prompts for comment and calls `resolveApproval` for `_source: "gate"`

## Integration tests

### Approve proposed issue (end-to-end)
1. Create an issue with `status: "proposed"` via `POST /mc/api/issues`
2. Verify it appears in `GET /mc/api/approvals`
3. PATCH it to `status: "todo"` via `PATCH /mc/api/issues/:id`
4. Verify it disappears from `GET /mc/api/approvals`
5. Verify it appears in the Issues list with status `todo`

### Reject proposed issue (end-to-end)
1. Create an issue with `status: "proposed"`
2. Verify it appears in `GET /mc/api/approvals`
3. DELETE via `/mc/api/files`
4. Verify it disappears from both approvals and issues

### Approve gate request (regression)
1. Write a pending approval file
2. Verify it appears in `GET /mc/api/approvals`
3. Resolve it via file writes
4. Verify tombstone is created and item disappears from pending list

### Mixed content
1. Create 2 proposed issues in project A, 1 gate request in project B
2. Verify `GET /mc/api/approvals` returns all 3 grouped correctly
3. Verify `GET /mc/api/approvals?project=A` returns only the 2 issues
4. Verify `GET /mc/api/approvals?project=B` returns only the 1 gate

## Manual checks

### Global Approvals page
- [ ] Items grouped by project, alphabetically
- [ ] Within each project group, newest items first
- [ ] Type badge visible: "Issue" vs gate name (e.g. "experiment-start")
- [ ] Approve/reject buttons work for both types
- [ ] Clicking a proposed issue navigates to ApprovalDetail (not IssueDetail)
- [ ] Clicking a gate request navigates to ApprovalDetail (existing behavior)
- [ ] Empty state shows when no pending items

### Per-project Approvals tab
- [ ] Shows both proposed issues and gate requests for that project
- [ ] Tab badge counts both types
- [ ] Approve/reject works from this view

### Issues tab
- [ ] No violet "proposed" banner
- [ ] Only shows issues with status backlog through cancelled
- [ ] Proposed issues are not visible here

### Sidebar
- [ ] Approvals badge reflects total count (gates + proposed issues)
- [ ] Badge updates after approving/rejecting (polls every 30s)

### ApprovalDetail page (proposed issues)
- [ ] Shows issue title, description, priority, requester
- [ ] Approve moves issue to "todo"
- [ ] Reject deletes the issue
- [ ] Back navigation returns to Approvals page

## Regression risk

- **Gate approval flow** — the existing `resolveApproval` path must not break. Verify tombstone creation, notification writes, and agent detection still work.
- **Sidebar badge** — currently counts `getApprovals().length`. After change, this includes proposed issues. Verify the count is correct and doesn't double-count with inbox.
- **Inbox counts** — the inbox endpoint separately counts `proposed_issue` type. This is NOT changing. Verify inbox badge still works correctly (it adds approvals + budget + tasks + proposed, which is still the right total).
- **Issue creation** — `POST /mc/api/issues` always creates with `status: "todo"`. Agents creating proposed issues must be setting status to "proposed" via a PATCH or direct file write. Verify this path is unaffected.
