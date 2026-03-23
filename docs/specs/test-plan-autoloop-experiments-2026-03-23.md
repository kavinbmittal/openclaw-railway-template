# Test Plan — Autoloop Experiments

Spec: `docs/specs/autoloop-experiments (2026-03-23).md`

---

## Server: Required Tools parsing

- [ ] `parseExperimentMeta()` extracts `## Required Tools` section from program.md
- [ ] Returns array of tool objects with `name`, `checked` (boolean), `description`
- [ ] Handles program.md with no Required Tools section (backward compat — returns empty array)
- [ ] Handles empty Required Tools section (no items)
- [ ] Handles mixed `[x]` and `[ ]` items correctly
- [ ] Strips Required Tools section from rendered `programMd` (same as Theme/Hypothesis stripping)
- [ ] `GET /mc/api/approvals/:id` returns `required_tools` field for experiment gates

## Server: pause status derivation

- [ ] `deriveStatusFromResults()` returns `paused` when latest decision is `pause`
- [ ] After `pause`, a subsequent `keep` row returns status to `running`
- [ ] `pause` → `kill` works (experiment killed while paused)
- [ ] `pause` → `scale` works (experiment completed while paused — unlikely but valid)
- [ ] `buildPhases()` includes pause as a phase node (orange color)
- [ ] Backward compat: experiments without any `pause` rows work unchanged

## Server: pause inbox notifications

- [ ] Inbox scanner picks up `{exp-dir}-pause-{date}.json` update files
- [ ] Pause updates render in inbox with correct category ("Experiment Updates")
- [ ] Pause decision badge uses orange color (distinct from keep/pivot/scale/kill)

## Frontend: ApprovalDetail — Required Tools checklist

- [ ] Experiment approval shows "Required Tools" card when tools are present
- [ ] Each tool renders with green checkmark (`[x]`) or red X (`[ ]`)
- [ ] Tool description text renders after the status icon
- [ ] Approve button is disabled when any tool is `[ ]`
- [ ] Disabled state shows message: "Resolve tool access before approving"
- [ ] Approve button enables when all tools are `[x]`
- [ ] No Required Tools section → no card rendered, approve works normally (backward compat)
- [ ] Empty Required Tools section → no card rendered, approve works normally

## Frontend: ExperimentDetail — paused state

- [ ] `paused` status badge renders in orange
- [ ] Paused experiments show pulsing dot (like `running` but orange)
- [ ] Phase arc includes pause node in orange
- [ ] Run history table shows pause rows with orange left border accent
- [ ] Pause reason text displays in muted style (same as other decision reasons)

## Integration: full proposal-to-approval flow

- [ ] Create a test experiment with all `[x]` tools → approve button active → can approve
- [ ] Create a test experiment with one `[ ]` tool → approve button blocked
- [ ] Update the `[ ]` tool to `[x]` in program.md → refresh → approve button active
- [ ] Approve experiment → verify gate status changes to approved

## Integration: pause and resume flow

- [ ] Write a `pause` row to results.tsv → experiment status changes to `paused` on refresh
- [ ] Verify pause update JSON appears in inbox
- [ ] Write a `keep` row after pause → status returns to `running`

## Regression: existing experiments

- [ ] Experiments without Required Tools section render unchanged
- [ ] Experiments without any `pause` decisions render unchanged
- [ ] Status derivation for `keep`, `pivot`, `scale`, `kill` unchanged
- [ ] Inbox rendering for existing update types unchanged
- [ ] Phase arc for existing experiments unchanged

## Manual checks (not automatable)

- [ ] Verify design matches DESIGN.md: orange badge color, card styling, disabled button state
- [ ] Verify tool checklist is readable at a glance — status icons clear, descriptions not truncated
- [ ] Verify blocked approve message is clear and not alarming

## Protocol updates (Railway SSH — separate from dashboard build)

- [ ] `experiments.md` updated: Required Tools section format with execute + measure
- [ ] `experiments.md` updated: auto-execute rule (approval = go, heartbeat pickup)
- [ ] `experiments.md` updated: re-validate tools before every scheduled action
- [ ] `experiments.md` updated: pause decision protocol (write row, update JSON, notify)
- [ ] `autoresearch.md` updated: same changes as experiments.md
