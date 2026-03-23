# Agent Model Routing — Baseline Spec
March 23, 2026

## What This Means for Users

You see what model tier every agent runs on. You set the tier on every issue — from Claude Code (full autonomous agent) down to Runner (simple mechanical tasks). Cost breaks down by model tier. When agents self-escalate (retry at a higher tier), you see it. One page manages the whole routing table — agent assignments, research phase mapping, and six tier definitions. Defaults handle 90% of decisions. You intervene on the 10% that's high-stakes.

## Problem

Model assignment is ad hoc. Lead agents spin up sub-agents on whatever default is set. There's no visibility into which model ran what, no way to override from the dashboard, and no tracking when agents escalate. You're either overpaying (Opus on everything) or getting bad output (Haiku on judgment tasks).

## Approach

Single-field resolution: the issue's `complexity` field maps to a tier in the routing config, which resolves to a model + thinking level (or Claude Code). All config lives as a JSON file on the Railway volume. Mission Control reads and writes it. Agents read it at task creation time.

**How it flows:** When a lead agent picks up an issue and spawns a sub-agent, it reads the issue's `complexity` field and looks it up in `shared/model-routing.json`. If the tier is "claude-code," it spawns a Claude Code session. Otherwise, it passes model + thinking as parameters to `sessions_spawn(model: "...", thinking: "...")`. These are existing parameters on `sessions_spawn` — no gateway changes needed.

**Why this approach:** One dropdown controls everything. No overlapping fields (complexity vs model override). The tier abstraction survives model generation changes — when Sonnet 4.7 drops, update one tier definition. Claude Code as a tier means execution environment is a first-class routing decision, not a bolt-on.

**Alternative rejected:** Model routing baked into each agent's SOUL.md. Rejected because it scatters config across 10+ files, makes the system state invisible from the dashboard, and requires editing agent workspaces to change a tier.

**Alternative rejected:** Mission Control writing directly to `openclaw.json` or `sessions.json`. Rejected because it risks race conditions on live gateway config and bypasses the agent as the natural decision-maker at spawn time.

## Scope

### In scope
- Routing config file (`shared/model-routing.json`) with 6 tier definitions (Claude Code, Complex, Strategic, Analyst, Operator, Runner), agent assignments, research phase mapping
- Routing Config page in Mission Control (view + edit, explicit save) — sections: Agent Assignments, Research Phase Mapping, Model Tier Definitions
- Issue-level `complexity` (maps to tier) and `escalation_count` fields
- Issue Create/Edit UI with tier dropdown and budget field
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
    "claude-code": { "model": "claude-code", "thinking": "adaptive" },
    "complex": { "model": "anthropic/claude-opus-4-6", "thinking": "high" },
    "strategic": { "model": "anthropic/claude-opus-4-6", "thinking": "adaptive" },
    "analyst": { "model": "anthropic/claude-sonnet-4-6", "thinking": "high" },
    "operator": { "model": "anthropic/claude-sonnet-4-6", "thinking": "medium" },
    "runner": { "model": "anthropic/claude-haiku-4-5", "thinking": "off" }
  },
  "agents": {
    "sam": "strategist",
    "binny": "analyst",
    "leslie": "analyst",
    "ritam": "analyst",
    "ej": "analyst",
    "kiko": "analyst",
    "zara": "operator",
    "jon": "operator",
    "midas": "operator"
  },
  "research_phases": {
    "hypothesis": "strategist",
    "execution": "operator",
    "analysis": "analyst",
    "synthesis": "strategist"
  }
}
```

Model strings use the gateway format (`anthropic/claude-opus-4-6`). Thinking levels map to `sessions_spawn`'s `thinking` parameter: `off | minimal | low | medium | high | xhigh | adaptive`.

### Issue schema additions (2 new fields)

```json
{
  "complexity": "claude-code" | "complex" | "strategic" | "analyst" | "operator" | "runner",
  "escalation_count": 0
}
```

- `complexity`: set by lead agent at issue creation, editable from dashboard. Maps directly to a tier in the routing config, which resolves to a model + thinking level. "claude-code" means spawn a Claude Code session instead of a direct API call.
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
1. Read issue JSON → get complexity
2. Read shared/model-routing.json
3. Look up complexity as a tier name → get model + thinking
4. If tier is "claude-code":
     → Spawn a Claude Code session with the task
5. Else:
     → sessions_spawn(model: resolved_model, thinking: resolved_thinking)
6. (v2) If sub-agent fails:
     → Increment escalation_count on issue JSON
     → Retry at next tier up (runner→operator→analyst→strategic→complex)
     → Write updated escalation_count back to issue file
```

This uses `sessions_spawn`'s existing `model` and `thinking` parameters for non-Claude Code tiers. No gateway changes.

## Surfaces

### 1. Routing Config page (new, sidebar nav)

Three sections, all editable with dropdowns, single Save button at top.

**Agent Assignments** — List of all agents. Each has a tier dropdown (claude-code/complex/strategic/analyst/operator/runner). Shows resolved model + thinking next to the dropdown.

**Research Phase Mapping** — Four rows (hypothesis, execution, analysis, synthesis). Each has a tier dropdown. Shows resolved model next to it.

**Model Tier Definitions** — Six rows. Claude Code shows as a fixed label (no model/thinking dropdowns — it's an execution environment, not a model). Other tiers: model dropdown + thinking dropdown. Changing a tier definition updates all agents and research phases assigned to it.

Save writes to `shared/model-routing.json`. No auto-save — explicit button with confirmation.

### 2. Issue Create/Edit — model section

Below existing fields (after labels):

- **Model Tier** dropdown: Claude Code, Complex, Strategic, Analyst, Operator, Runner. Default: Operator.
- **Budget ($)** input: max spend for this issue. Agent pauses if exceeded.
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

Issue endpoints (`POST /mc/api/issues`, `PATCH /mc/api/issues/:id`) already exist — they accept the new fields. Validation:
- `complexity` must be one of `claude-code`, `complex`, `strategic`, `analyst`, `operator`, `runner`
- `escalation_count` must be a non-negative integer

## Resolution Order

When a lead agent picks up an issue and needs to decide how to execute:

```
1. Read issue JSON → get complexity
2. Read shared/model-routing.json → look up complexity as tier name
3. If tier is "claude-code" → spawn Claude Code session
4. Else → sessions_spawn(model: tier.model, thinking: tier.thinking)
5. If no complexity set → use agent's own tier assignment from routing config
```

This logic lives in the agents, not in Mission Control. Mission Control makes the data available. Agent protocols need updating to read `model-routing.json` and issue complexity at spawn time.

## Failure Paths

**Routing config file missing:** API returns 404. Dashboard shows empty state with "Configure routing" CTA. Agents fall back to `agents.defaults.subagents.model` in `openclaw.json` (existing behavior, no breaking change).

**Routing config has unknown agent:** Ignored. Dashboard only shows agents it knows about. Extra entries are harmless.

**Cost entries without model field:** Legacy entries. Dashboard shows "Model data not available" for the tier breakdown. No backfill needed — new entries carry the field going forward.

**Agent doesn't read routing config (protocol not yet updated):** No breakage. Agents continue using `openclaw.json` defaults. The routing config is additive — it only takes effect once agent protocols are updated to read it.

## Key Decisions

| Decision | Choice | Why | Alternative Rejected |
|----------|--------|-----|---------------------|
| Single routing config file vs per-agent config | Single file | One source of truth, visible from dashboard, no workspace file scattering | Per-agent SOUL.md model blocks — invisible, scattered |
| Tier-based vs model-name-based | Tier-based | Survives model generation changes. When Sonnet 4.7 drops, update one tier definition | Direct model names on agents — brittle |
| Claude Code as a tier (not a model) | Own tier | It's an execution environment, not a model. No model/thinking config needed. | Modifier on existing tiers — conflates two concepts |
| Complexity = tier (no separate override) | Single field | Complexity maps directly to tier. Override was redundant — if you want a different model, change the tier. | Separate model_override field — overlapping controls |
| Six tiers | Claude Code, Complex, Strategic, Analyst, Operator, Runner | Matches cognitive demand spectrum from full autonomy to mechanical tasks | Three or four — too coarse for routing decisions |
| Live save vs approval flow | Live save with explicit button | Kavin is the only operator. Approval gate on own config adds friction with no upside | Approval flow — unnecessary for single operator |
| Experiment-level override | Deferred to v2 | Issue-level tier covers immediate need. Experiment override requires additional schema work | Build now — premature without usage data |
| Dashboard writes to openclaw.json directly | Rejected | Race conditions on live gateway config. Agent is the natural decision-maker at spawn time. | Direct config writes — risky, bypasses agent |
