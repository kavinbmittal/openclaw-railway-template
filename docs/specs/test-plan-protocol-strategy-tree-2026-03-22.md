# Test Plan: Protocol Strategy Tree Update

## Manual Checks (all — protocol changes can't be unit tested)

### Protocol consistency
- [ ] `projects.md` has no references to "milestones" — search the full file
- [ ] `experiments.md` program.md template includes Theme and Proxy Metrics sections
- [ ] `claude-code.md` says "proposing themes" not "milestones"
- [ ] All 8 AGENTS.md files reference "title" not "what" in the approval tip
- [ ] Theme JSON format in projects.md matches what the dashboard actually parses
- [ ] Experiment gate format in projects.md matches what the dashboard actually parses

### Existing experiment gates ported
- [ ] All gates in `approvals/pending/` and `approvals/resolved/` use `title` not `what`
- [ ] All experiment gates have `hypothesis` and `program` instead of `why`
- [ ] No data loss — original content preserved in new fields

### Dashboard — experiment approval detail
- [ ] Open an experiment approval on the dashboard — hypothesis, program, theme, proxy metrics with targets all display
- [ ] Old experiment gates (if any remain) still render without crashing (fallback to `why` if new fields missing)
- [ ] Non-experiment gates (deploy, scope-change) still render correctly with `why` as markdown

### Regression
- [ ] Theme approval flow still works (propose → approve → shows on Strategy tab)
- [ ] Issue creation with theme tagging still works
- [ ] Existing approved themes on lia-first-100 still display correctly
- [ ] Sidebar approval badge count still correct
