# Agent Model Routing — Baseline Spec
March 23, 2026

## What This Means for Users

You see what model tier every agent runs on. You can force a specific model and thinking level on any issue from the dashboard. Cost breaks down by model tier. When agents self-escalate (retry at a higher tier), you see it. One page manages the whole routing table — tiers, agent assignments, research phase mapping. Defaults handle 90% of decisions. You intervene on the 10% that's high-stakes.

## Problem

Model assignment is ad hoc. Lead agents spin up sub-agents on whatever default is set. There's no visibility into which model ran what, no way to override from the dashboard, and no tracking when agents escalate. You're either overpaying (Opus on everything) or getting bad output (Haiku on judgment tasks).

## Approach

Three-layer resolution: issue-level override (if set) beats lead agent heuristic (complexity classification) beats routing config defaults. All config lives as a JSON file on the Railway volume. Mission Control reads and writes it. Agents read it at task creation time.

**How it flows:** When a lead agent picks up an issue and spawns a sub-agent, it reads the issue JSON and `shared/model-routing.json`, resolves the model + thinking level, and passes them as parameters to `sessions_spawn(model: "...", thinking: "...")`. These are existing parameters on `sessions_spawn` — no gateway changes needed.

**Why this approach:** It matches the existing pattern — Mission Control writes files, agents read them. The routing config is a single source of truth, and the issue override is the kill switch. Model and thinking map directly to `sessions_spawn` parameters that already exist.

**Alternative rejected:** Model routing baked into each agent's SOUL.md. Rejected because it scatters config across 10+ files, makes the system state invisible from the dashboard, and requires editing agent workspaces to change a tier.

**Alternative rejected:** Mission Control writing directly to `openclaw.json` or `sessions.json`. Rejected because it risks race conditions on live gateway config and bypasses the agent as the natural decision-maker at spawn time.

## Scope

### In scope
- Routing config file (`shared/model-routing.json`) with tier definitions, agent assignments, research phase mapping
- Routing Config page in Mission Control (view + edit, explicit save)
- Issue-level `model_override`, `thinking_override`, `complexity`, `escalation_count` fields
- Issue Create/Edit UI for model override, thinking override, and complexity
- Agent Detail tier badge showing assigned tier + resolved model
- Project cost breakdown by model tier

### Out of scope (v2)
- Experiment-level model override (override whole research loop)
- Escalation logic (agents incrementing `escalation_count`, retry at higher tier)
- Escalation pattern insights / recommendations
- Agent protocol updates (teaching agents to read `model-routing.json` — separate OpenClaw workspace deliverable)
- Dynamic model switching mid-task
- Cost optimization via caching/batching
- Per-token cost tracking per agent
- Open-source model integration

## Data Model

### `shared/model-routing.json` (new file, Railway volume)

```json
{
  "tiers": {
    "coordinator": { "model": "anthropic/claude-opus-4-6", "thinking": "adaptive" },
    "lead": { "model": "anthropic/claude-sonnet-4-6", "thinking": "high" },
    "complex": { "model": "anthropic/claude-sonnet-4-6", "thinking": "medium" },
    "simple": { "model": "anthropic/claude-haiku-4-5", "thinking": "off" }
  },
  "agents": {
    "sam": "coordinator",
    "binny": "lead",
    "leslie": "lead",
    "ritam": "lead",
    "ej": "lead",
    "kiko": "lead",
    "zara": "complex",
    "jon": "complex",
    "midas": "complex"
  },
  "research_phases": {
    "hypothesis": "coordinator",
    "execution": "complex",
    "analysis": "lead",
    "synthesis": "coordinator"
  }
}
```

Model strings use the gateway format (`anthropic/claude-opus-4-6`). Thinking levels map to `sessions_spawn`'s `thinking` parameter: `off | minimal | low | medium | high | xhigh | adaptive`.

### Issue schema additions (4 new fields)

```json
{
  "model_override": null | "anthropic/claude-opus-4-6" | "anthropic/claude-sonnet-4-6" | "anthropic/claude-haiku-4-5",
  "thinking_override": null | "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "adaptive",
  "complexity": "simple" | "complex" | "strategic",
  "escalation_count": 0
}
```

- `model_override`: null means use routing defaults. When set, the lead agent passes this directly to `sessions_spawn(model: "...")`.
- `thinking_override`: null means use the tier's default thinking level. When set, passed to `sessions_spawn(thinking: "...")`.
- `complexity`: set by lead agent at issue creation, editable from dashboard. Drives sub-agent tier selection when no override is set. `simple` → simple tier, `complex` → complex tier, `strategic` → lead tier.
- `escalation_count`: incremented by lead agents when a sub-agent fails and retries at a higher tier. Read-only in dashboard.

### Cost entries (new field on existing schema)

```json
{
  "model": "anthropic/claude-sonnet-4-6"
}
```

Added to cost line items so the dashboard can aggregate by model.

## How Agents Consume This

The lead agent's spawn flow becomes:

```
1. Read issue JSON → get model_override, thinking_override, complexity
2. If model_override is set:
     → sessions_spawn(model: model_override, thinking: thinking_override || tier default)
3. Else:
     → Read shared/model-routing.json
     → Map complexity to tier name (simple→simple, complex→complex, strategic→lead)
     → Resolve tier → get model + thinking
     → sessions_spawn(model: resolved_model, thinking: resolved_thinking)
4. (v2) If sub-agent fails:
     → Increment escalation_count on issue JSON
     → Retry at next tier up (simple→complex→lead→coordinator)
     → Write updated escalation_count back to issue file
```

This uses `sessions_spawn`'s existing `model` and `thinking` parameters. No gateway changes.

## Surfaces

### 1. Routing Config page (new, sidebar nav)

Three sections, all editable with dropdowns, single Save button at top.

**Tier Definitions** — Four rows. Each row: tier name (read-only label), model dropdown (lists available models), thinking dropdown (off/minimal/low/medium/high/xhigh/adaptive). Changing a tier definition changes the resolved model for every agent and research phase assigned to that tier.

**Agent Assignments** — List of all agents. Each has a tier dropdown (coordinator/lead/complex/simple). Shows resolved model + thinking next to the dropdown.

**Research Phase Mapping** — Four rows (hypothesis, execution, analysis, synthesis). Each has a tier dropdown. Shows resolved model next to it.

Save writes to `shared/model-routing.json`. No auto-save — explicit button with confirmation.

### 2. Issue Create/Edit — model section

Below existing fields (after labels):

- **Complexity** dropdown: Simple, Complex, Strategic. Default: Complex.
- **Model Override** dropdown: Auto (use routing defaults), Opus 4.6, Sonnet 4.6, Haiku 4.5. Default: Auto.
- **Thinking Override** dropdown: Auto (use tier default), Off, Minimal, Low, Medium, High, Extra High, Adaptive. Default: Auto. Only visible when Model Override is not Auto.
- **Escalation Count** (edit page only, read-only): shows number with muted label.

When Model Override is set to anything other than Auto, show a subtle indicator: "This issue will run on [model] regardless of routing defaults."

### 3. Agent Detail — tier badge

Next to the agent's name/role in the sticky header: a small badge showing tier name and resolved model. Example: `LEAD · Sonnet 4.6 (high)`.

Data comes from `shared/model-routing.json` — look up agent ID in the agents map, resolve through tiers.

### 4. Project costs — tier breakdown

On the existing Costs tab, add a "Cost by Model" section above the per-agent breakdown. Three rows:
- Opus 4.6: $X.XX
- Sonnet 4.6: $X.XX
- Haiku 4.5: $X.XX

Requires cost entries to carry `model` field. If entries don't have it (legacy), show "Model data not available" instead of the breakdown.

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/mc/api/model-routing` | Read routing config |
| PUT | `/mc/api/model-routing` | Write routing config (full replace) |

Issue endpoints (`POST /mc/api/issues`, `PATCH /mc/api/issues/:id`) already exist — they accept the four new fields. Validation:
- `model_override` must be null or a valid `provider/model` string
- `thinking_override` must be null or one of `off|minimal|low|medium|high|xhigh|adaptive`
- `complexity` must be one of `simple`, `complex`, `strategic`
- `escalation_count` must be a non-negative integer

## Resolution Order

When a lead agent picks up an issue and needs to decide which model to use for `sessions_spawn`:

```
1. issue.model_override (if not null) → use as sessions_spawn model parameter
2. issue.thinking_override (if not null) → use as sessions_spawn thinking parameter
3. If no overrides → read shared/model-routing.json:
   a. Map issue.complexity to tier (simple→simple, complex→complex, strategic→lead)
   b. Resolve tier → get model + thinking
   c. Use as sessions_spawn parameters
4. If no complexity set → use agent's own tier assignment from routing config
```

This logic lives in the agents, not in Mission Control. Mission Control makes the data available. Agent protocols need updating to read `model-routing.json` and issue model fields at spawn time.

## Failure Paths

**Routing config file missing:** API returns 404. Dashboard shows empty state with "Configure routing" CTA. Agents fall back to `agents.defaults.subagents.model` in `openclaw.json` (existing behavior, no breaking change).

**Routing config has unknown agent:** Ignored. Dashboard only shows agents it knows about. Extra entries are harmless.

**Issue has model_override set to a model that gets deprecated:** The override string becomes stale. Agent should treat unrecognized model strings as "fall back to routing defaults" and log a warning. Dashboard shows the stale value with a warning indicator.

**Cost entries without model field:** Legacy entries. Dashboard shows "Model data not available" for the tier breakdown. No backfill needed — new entries carry the field going forward.

**Agent doesn't read routing config (protocol not yet updated):** No breakage. Agents continue using `openclaw.json` defaults. The routing config is additive — it only takes effect once agent protocols are updated to read it.

## Key Decisions

| Decision | Choice | Why | Alternative Rejected |
|----------|--------|-----|---------------------|
| Single routing config file vs per-agent config | Single file | One source of truth, visible from dashboard, no workspace file scattering | Per-agent SOUL.md model blocks — invisible, scattered |
| Tier-based vs model-name-based | Tier-based | Survives model generation changes. When Sonnet 4.7 drops, update one tier definition | Direct model names on agents — brittle |
| Model + thinking as separate fields | Separate | Maps 1:1 to `sessions_spawn` parameters. No parsing needed. | Colon-delimited strings (`sonnet:high`) — requires parsing, doesn't match gateway format |
| Gateway model string format | `anthropic/claude-opus-4-6` | Matches what `sessions_spawn` actually accepts. No translation layer. | Short names (`opus`, `sonnet`) — ambiguous, requires mapping |
| Complexity field on issues | Three levels (simple/complex/strategic) | Matches cognitive demand, not effort level. Strategic = judgment, complex = multi-step, simple = mechanical | Five levels — over-granular for routing purposes |
| Live save vs approval flow | Live save with explicit button | Kavin is the only operator. Approval gate on own config adds friction with no upside | Approval flow — unnecessary for single operator |
| Experiment-level override | Deferred to v2 | Issue override covers immediate need. Experiment override requires additional schema work | Build now — premature without usage data |
| Dashboard writes to openclaw.json directly | Rejected | Race conditions on live gateway config. Agent is the natural decision-maker at spawn time. | Direct config writes — risky, bypasses agent |
