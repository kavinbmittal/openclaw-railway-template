# Autoloop Experiments

## What This Means for Users

When you approve an experiment, it runs. No second ask, no issue filed, no "should I go?" from the agent. The agent picks up the approval on its next heartbeat and begins executing the plan it proposed — posting content, engaging, measuring results, making decisions.

Before approval, you see exactly what tools the agent needs and whether each one is ready. If Reddit posting requires a logged-in browser session and that session is dead, you see a red X next to it. You can't approve until every tool is green — or until you've unblocked the missing ones yourself.

Agents can no longer propose experiments with vague tool requirements. "Browser access" isn't enough. They must declare the specific platform, the specific action, the auth state, and how they'll measure results — all cross-referenced against the live tool registry.

---

## Problem Being Solved

Experiments stall after approval because:

1. **No auto-execute rule.** Agents treat approval as "approved plan" rather than "go." They loop back to ask permission they already have.
2. **No tool validation.** Agents propose experiments without confirming they can actually execute. You approve, nothing happens, and the failure is silent.
3. **No measurement path.** Agents know how to post but not how to read back results. The experiment runs but never closes the loop.

---

## Approach

Protocol-first. No gateway code changes. No new platform APIs. The system works through:

- Updated `program.md` format with a Required Tools section
- Agent self-validation against `shared/tools/registry.md`
- Approval gating in Mission Control UI (block approve if any tool is red)
- Heartbeat-driven execution pickup
- Updated per-tool docs with execute + measure sections

---

## Scope

### In scope

- New `## Required Tools` section in `program.md` format
- Agent self-validation protocol (cross-reference registry at proposal time)
- Auto-execute protocol rule (approval = go, heartbeat pickup)
- Mission Control approval UI: tool checklist with green/red status, blocked approve button
- Per-tool doc format standard (execute + measure sections)
- Experiment pause behavior when a tool breaks mid-run

### Out of scope

- Gateway callbacks or webhooks on approval
- Automatic tool provisioning (you unblock tools manually)
- Writing the actual tool docs (Kavin owns this in parallel)
- ExperimentDetail.jsx showing Required Tools (deferred — approval view first)

---

## Design

### 1. program.md — Required Tools section

New mandatory section added after `## Proxy Metrics`, before `## Program`:

```markdown
## Required Tools

- <status> <platform/scope> — <action> (<method>) + measure (<method>: <available metrics>)
```

Example:

```markdown
## Required Tools

- [x] typefully/X(@kavinbm) — schedule posts (API: TYPEFULLY_API_KEY) + measure (API: impressions, engagements, link clicks)
- [x] typefully/LinkedIn(@kavinbm) — schedule posts (API: TYPEFULLY_API_KEY) + measure (API: impressions, engagements)
- [ ] reddit/r/productivity — post and reply (Mac mini browser: logged-in session) + measure (browser scrape: upvotes, comments, profile clicks)
- [x] youtube-transcript — extract transcripts (skill: no auth) + measure (n/a — input tool only)
- [ ] supabase/utm — track signups and clicks (needs: ISSUE-011 UTM tracking setup) + measure (SQL query: clicks, signups, conversion rate)
```

Rules:
- `[x]` = verified against `shared/tools/registry.md`, tool is `Active`
- `[ ]` = tool is missing, degraded, or not yet set up
- Each entry must declare both **execute** and **measure** capabilities
- If a tool is execute-only (no measurement needed), mark measure as `n/a` with reason
- If a tool can execute but can't measure, that's `[ ]` — experiment can't run without a measurement path
- Agent MUST cross-reference `shared/tools/registry.md` for status. No guessing, no assuming.

### 2. Tool registry cross-reference protocol

When an agent proposes an experiment, three checks must pass for each tool — all three for `[x]`:

1. **Agent's TOOLS.md** — confirm the agent has the tool and knows its specific config (e.g. which Typefully social set, which email alias, which browser profile). If the agent's TOOLS.md doesn't mention the tool, it's `[ ]`.
2. **`shared/tools/registry.md`** — confirm the tool is currently `Active` (not `Pending`, `Degraded`, or `Down`). The registry is the auth source of truth.
3. **`shared/tools/<tool>.md`** — confirm the tool doc has a `## How to Measure` section. If the measurement path is unverified, mark as `[ ]`.

Write the `## Required Tools` section with real status from all three sources, not aspirational status.

### 3. Per-tool doc format

Each `shared/tools/<tool>.md` should follow:

```markdown
# <Tool Name>

## How to Execute
- What actions are available
- Which agent capabilities/auth are needed
- Step-by-step for the primary action

## How to Measure
- What metrics are available
- How to retrieve them (API call, browser scrape, SQL query, etc.)
- What format the data comes back in
- Recommended measurement cadence

## Auth & Access
- Current status (reference registry.md)
- What breaks if auth expires
- How to re-auth
```

Kavin maintains these docs. Agents reference them but don't modify them.

### 4. Approval gating in Mission Control

When displaying an experiment proposal in the approval detail view:

- Parse `## Required Tools` from `program.md`
- Render each tool as a line item with green checkmark or red X
- If ANY tool is `[ ]` (unchecked): disable the Approve button, show message: "Resolve tool access before approving"
- Kavin can still see the full proposal and plan while tools are being unblocked
- Once all tools are `[x]`, Approve button becomes active

### 5. Auto-execute on heartbeat

New protocol rule added to `shared/protocols/experiments.md`:

> **Approval = execution.** When an experiment's gate request is approved, the owning agent begins execution on its next heartbeat cycle. No follow-up message, no issue creation, no second permission request.

Heartbeat pickup flow:

1. Agent heartbeat fires (existing cadence)
2. Agent checks for approved `autoresearch-start` or `experiment-start` gates
3. If a newly approved experiment is found, agent reads `program.md` for the execution plan
4. Agent begins executing per the schedule defined in `## Program`
5. Agent logs first measurement to `results.tsv` (status becomes `running`)

### 6. Tool re-validation before every action

Agents re-check `shared/tools/registry.md` before every scheduled action — not just at experiment start. If an experiment posts Mon/Wed/Fri and the Reddit session dies Tuesday, the Wednesday post catches it before failing silently.

Flow for each scheduled action:
1. Read `shared/tools/registry.md` for each tool in `## Required Tools`
2. If all tools are `Active` → execute the action
3. If any tool is not `Active` → pause (see below)

### 7. Mid-run tool failure — pause decision

`pause` is a new decision value in `results.tsv`, alongside `keep`, `pivot`, `scale`, `kill`.

If an agent discovers a tool is broken during execution:

1. Update `shared/tools/registry.md` status to `Degraded` or `Down`
2. Write a `pause` row to `results.tsv` with reason (e.g., "Reddit browser session expired")
3. Write an update JSON to `shared/projects/{slug}/updates/`:
   - `"decision": "pause"`, `"reason": "..."`, `"agent": "leslie"`
   - Filename: `{exp-dir}-pause-{date}.json`
4. Inbox shows pause notification with orange badge (urgent but not dead)
5. On next heartbeat, agent re-checks registry — if tool is back to `Active`, writes a `keep` row and resumes

Status derivation update:
- Latest decision is `pause` → status is `paused`
- `paused` experiments show a distinct badge in the dashboard (orange, pulsing dot like `running` but different color)

This prevents silent failures. The experiment doesn't die because Reddit logged out — it pauses, tells you, and resumes when you fix it.

---

## Failure Modes

| Failure | What happens |
|---|---|
| Agent proposes with tool it doesn't actually have | Caught at proposal — must cross-reference registry |
| Tool auth expires after approval, before execution | Caught at heartbeat — agent re-checks registry before starting |
| Tool breaks mid-experiment | Pause + notify, not kill |
| Agent ignores auto-execute rule | Visible — experiment stays `planned` past approval, heartbeat should catch |
| Registry is stale / not updated | Agent's responsibility to update if it discovers a discrepancy |
| Measurement path doesn't work | First measurement attempt fails → pause + notify |

---

## Key Decisions

| Decision | Choice | Why | Alternative rejected |
|---|---|---|---|
| Heartbeat pickup vs gateway callback | Heartbeat | Uses existing infrastructure, no gateway changes | Gateway callback — requires platform code changes |
| Agent self-validates vs platform validates | Agent self-validates | No platform changes needed, registry is the source of truth | Platform validation — adds coupling, gateway needs to understand tool semantics |
| Block approve vs warn on missing tools | Block approve | Prevents approving experiments that can't execute | Warn only — defeats the purpose, same stall problem |
| Agents can propose with missing tools | Yes | Lets you see the full plan and decide whether to unblock tooling | Block proposal — too restrictive, kills creative experiment proposals |
| Pause vs kill on tool failure | Pause | Tool failures are transient, experiments are valuable | Auto-kill — too aggressive, loses experiment context and progress |
| Pause as results.tsv decision | Yes — `pause` decision value | Fits existing status derivation system, visible in dashboard and inbox | Informal pause (just stop posting) — invisible, no notification |
| Re-validate before every action vs only at start | Every action | Catches tool failures between scheduled actions, prevents silent mid-schedule failures | Start-only — misses tools that break between Mon and Wed posts |
| Tool status ownership | Agent writes program.md, Kavin fixes tools + registry | No server cross-referencing needed, agent re-validates when told tool is fixed | Server live cross-reference — overcomplicates, Kavin controls when to approve |
| Tool docs owned by Kavin | Yes | Tool auth and access is infra, not agent responsibility | Agent-maintained — agents shouldn't modify their own capability docs |

---

## What Changes Where

| Location | Change | Owner |
|---|---|---|
| `shared/protocols/experiments.md` (Railway) | Add auto-execute rule, Required Tools format, re-validate before every action, pause decision, heartbeat pickup flow | This spec |
| `shared/protocols/autoresearch.md` (Railway) | Same protocol updates as experiments.md | This spec |
| `shared/tools/registry.md` (Railway) | Already exists — no format changes needed | Kavin (maintenance) |
| `shared/tools/*.md` (Railway) | Add `How to Execute` + `How to Measure` sections | Kavin |
| `src/server.js` | `parseExperimentMeta()`: extract Required Tools section. `deriveStatusFromResults()`: add `pause` decision → `paused` status. Inbox: `pause` update JSON support | Build phase |
| `dashboard/src/pages/ApprovalDetail.jsx` | Render Required Tools checklist, block approve if any `[ ]` | Build phase |
| `dashboard/src/pages/ExperimentDetail.jsx` | `paused` status badge (orange, pulsing dot) | Build phase |

## Deferred

- **ExperimentDetail: show Required Tools section** — once running, you should see which tools the experiment depends on. Effort S. Depends on this spec shipping.
- **Pause auto-resume notification** — inbox notification when a paused experiment resumes (agent writes `keep` after `pause`). Effort S. Nice-to-have.
