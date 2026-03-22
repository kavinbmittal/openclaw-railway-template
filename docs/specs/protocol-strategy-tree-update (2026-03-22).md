# Protocol Update: Strategy Tree

## What This Means for Users

Agents stop creating milestones and start proposing themes with proxy metrics — the strategy framework Kavin defined. Every piece of work ties back to a theme, which ties back to the NSM. Experiment approvals get a cleaner structure with dedicated fields. The dashboard already supports themes; the agent instructions are what's stale.

## Problem

The agent protocol (`shared/protocols/projects.md`) still instructs agents to create milestones. There's no mention of NSM, themes, or proxy metrics. If an agent starts a new project today, they'd build milestones instead of the strategy tree.

Experiment approval gates use a flat `what`/`why` format where `why` is an unstructured markdown blob. Hard to scan on the dashboard.

## Approach

Update `shared/protocols/projects.md` and `shared/protocols/claude-code.md` on the Railway volume directly via SSH.

## Scope

**In scope:**
- 7 targeted changes to `projects.md` (milestones → themes)
- Restructured experiment approval format
- 1 line change in `claude-code.md`
- Scaffolding template update

**Out of scope:**
- Dashboard changes for new experiment format (follow-up)
- Removing milestones rendering from dashboard (lia-ship-ready still uses it)
- Proxy metric quality criteria (Kavin's judgment, not agent instructions)
- Proxy metric tracking/visualization (deferred)

## Changes to projects.md

### 1. Directory structure

Replace `milestones.md` with `themes/` directory. Add note: "Theme files live in `themes/{theme-id}.json`. See **Strategy Tree** section for format."

### 2. New "Strategy Tree" section

Explains the hierarchy and provides exact JSON format.

**Hierarchy:** Project → Mission → NSM → Themes → Proxy Metrics

- NSM set by Kavin at project creation in PROJECT.md. Agents do not modify it.
- Agents propose themes bundled with up to 3 proxy metrics as a single approval item.
- Theme title is short (shows on approval cards, issue tags). Description is one line (shows on Strategy tab only).
- Write theme JSON to `themes/` with `"status": "proposed"` — it shows up in the approvals queue.
- Once a project has approved themes, all issues and experiments must be tagged to a theme.
- If zero approved themes exist, untagged work is allowed (backward compat).

**Theme JSON format:**

```json
{
  "id": "theme-{slug}",
  "title": "Short Theme Title",
  "description": "One-line description of the strategic objective.",
  "status": "proposed",
  "proposed_by": "agent-name",
  "proposed_at": "ISO-8601",
  "proxy_metrics": [
    {
      "id": "pm-{slug}",
      "name": "Human-readable metric name",
      "description": "What this metric measures and why it matters"
    }
  ]
}
```

Status values: `proposed` → `approved` / `rejected` / `revision_requested`

**Issue tagging fields** (added to existing issue JSON):

```json
{
  "theme": "theme-{id}",
  "proxy_metrics": ["pm-{id}", "pm-{id}"]
}
```

### 3. Lead permissions

"Break the mission into milestones and tasks" → "Propose themes with proxy metrics against the NSM for approval, then create issues tagged to approved themes"

### 4. Experiment approval format

**Old format:**
```json
{
  "gate": "experiment-start",
  "what": "Short title",
  "why": "## Context\n## Plan\n## Expected Outcome\n## Resources & Cost\n## Risks"
}
```

**New format:**
```json
{
  "id": "project-gate-001",
  "project": "project-id",
  "requester": "agent-name",
  "gate": "experiment-start",
  "title": "Experiment Name",
  "hypothesis": "What we believe will happen and why.",
  "program": "Methodology, variables, resources, cost, and risks.",
  "theme": "theme-id",
  "proxy_metrics": [
    { "id": "pm-metric-id", "target": "+50 signups/week" }
  ],
  "experiment_path": "experiments/exp-001",
  "created": "ISO-8601",
  "status": "pending"
}
```

Key changes:
- `what` → `title` (rename to "Experiment Name")
- `why` (markdown blob) → `hypothesis` + `program` (structured fields)
- Expected Outcome removed — it's the `target` on each proxy metric
- Resources & Risk lives inside `program`
- `theme` and `proxy_metrics` with targets added (required when project has approved themes)

### 5. Approval gates — scope changes

"Scope changes (milestones not in the original mission)" → "Scope changes (themes not aligned with NSM)"

### 6. Heartbeat

"Propose new issues if milestones need them" → "Propose new issues tagged to approved themes, declaring which proxy metrics they aim to move"

### 7. Scaffolding

Replace `milestones.md` with `themes/.gitkeep` in the template

## Change to claude-code.md

"Before creating issues or milestones" → "Before creating issues or proposing themes"

## Non-experiment gates

Non-experiment approval gates (deploy-production, scope-change, external-integration, single-task-over-50) keep the existing format but rename `what` to `title` and add `theme`/`proxy_metrics` fields. The `why` field stays as markdown for these since they don't need a hypothesis.

## Key Decisions

| Decision | Rationale | Alternative rejected |
|----------|-----------|---------------------|
| Exact JSON format in protocol | Agents are literal — malformed files won't render on dashboard | Describe fields loosely |
| Theme + proxy metrics as single proposal | Strategy is one decision, not piecemeal | Separate proposals |
| `hypothesis` instead of `context` | Forces testable claims, not just background | Keep "Context" |
| Expected outcome = proxy metric target | Avoids redundancy | Separate field |
| Resources/risk inside `program` | Simpler form, natural grouping | Separate field |
| Tagging only required with approved themes | Backward compatible | Always require |

## Follow-up Work

- Dashboard: parse and render structured experiment fields (`hypothesis`, `program`, proxy metric targets)
- Dashboard: experiment approval detail page for new format
