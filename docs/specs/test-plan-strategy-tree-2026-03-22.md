# Test Plan — Strategy Tree (NSM, Themes, Proxy Metrics)

## Unit Tests

### Theme data model
- Theme JSON with valid fields → parses correctly
- Theme with 0 proxy metrics → rejected (min 1)
- Theme with 4+ proxy metrics → rejected (max 3)
- Theme with missing name → rejected
- Theme status transitions: proposed → approved, proposed → rejected, proposed → revision_requested

### Approvals endpoint (themes scan)
- Project with no themes dir → returns empty, no error
- Project with 1 proposed theme → included in approvals list
- Project with 1 approved theme → excluded from pending approvals
- Theme with `_source: "theme"` and correct type badge

### Issue/experiment validation
- Issue with theme + proxy_metrics → accepted
- Issue without theme when project has approved themes → rejected with clear error
- Issue without theme when project has zero approved themes → accepted (grace period)
- proxy_metrics references invalid metric ID → rejected
- proxy_metrics references metric from a different theme → rejected

### PROJECT.md parsing
- PROJECT.md with NSM field → parsed and returned in project summary
- PROJECT.md without NSM field → returns null, no error (backward compat)

## Integration Tests

### Theme proposal flow
1. Create project with mission + NSM
2. Write theme JSON to themes/ dir with status "proposed"
3. GET /mc/api/approvals → theme appears in list with type "theme"
4. GET /mc/api/approvals/:id → returns full theme with proxy metrics
5. Approve → theme status changes to "approved"
6. GET /mc/api/approvals → theme no longer in pending list
7. GET /mc/api/themes?project=slug → returns approved theme

### Issue tagging flow
1. Create project, approve a theme
2. Propose issue with theme + proxy_metrics fields
3. GET /mc/api/approvals → issue appears with theme tag visible
4. Approve issue → moves to todo with theme tag preserved

### Strategy tree display
1. Create project with NSM
2. Approve 2 themes with proxy metrics
3. Tag 2 issues to theme 1, 1 issue to theme 2
4. Project detail strategy tab shows: NSM → 2 themes → metrics → tagged items

## Manual Checks

### Create project form
- [ ] NSM field visible between Mission and Lead
- [ ] Help text displays correctly
- [ ] NSM value persists in PROJECT.md after creation
- [ ] Form works without NSM (backward compat for quick projects)

### Approval cards
- [ ] Theme proposals show teal "Theme" badge
- [ ] Theme detail page shows name, description, proxy metrics as structured list
- [ ] Approve/reject/revise works on themes
- [ ] Issue proposals show theme tag and target metrics below title

### Project detail — Strategy tab
- [ ] NSM displayed at top
- [ ] Approved themes listed with proxy metrics
- [ ] Theme description visible (one-liner, only on this page)
- [ ] Clicking a theme shows tagged issues/experiments
- [ ] Projects without themes show empty state, not an error

### Existing projects
- [ ] lia-first-100 loads without errors (no themes, has milestones)
- [ ] lia-ship-ready loads without errors
- [ ] Existing issues without theme tags still display correctly

## Regression Risk

| Risk | How to verify |
|------|---------------|
| Approvals endpoint slower with third scan | Load test with 50+ items across all sources |
| Existing issue creation breaks | Create issue from dashboard on project with no themes — should work |
| Project detail tabs shift | Verify all 7 existing tabs still render correctly |
| Sidebar approval count wrong | Count should include pending themes |
