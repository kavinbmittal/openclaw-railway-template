# Autoloop Experiments — Structured Proposals + Auto-Execute

Date: 2026-03-24
Status: Shipped

## What This Means for Users

When an agent proposes an experiment, you see every piece of the plan as a distinct card: what they'll do (Playbook), how they'll measure (Eval Method), when they'll decide (Decision Triggers), what tools they need (Required Tools), and what guardrails apply (Constraints). No more single markdown blob.

When you approve, the agent starts on its next heartbeat. No follow-up message, no issue creation. Approval = go. Agent keeps iterating until a terminal decision (kill or scale).

## Problem

Agents were proposing experiments as a single markdown blob, then creating follow-up issues asking for permission to execute after approval. Key operational details (how to measure, when to stop, what tools are needed) were buried in unstructured text. No way to verify the measurement approach or decision criteria before approving.

## Approach: Structured program.md + Three-Check Tool Validation + Auto-Execute

Merged `autoresearch.md` into `experiments.md` as the single canonical protocol. Restructured `program.md` from one big blob into seven parseable sections. Added three capabilities inspired by Karpathy's autoresearch system:

### 1. Structured program.md (7 sections)
- Theme, Hypothesis, Proxy Metrics (unchanged)
- **Playbook** — the execution plan (only section that changes between iterations)
- **Required Tools** — [x]/[ ] checklist with three-check validation
- **Eval Method** — sacred measurement function, does not change between iterations
- **Decision Triggers** — explicit pivot/kill/scale signals + minimum runtime + max iterations
- **Constraints** — guardrails

### 2. Three-Check Tool Validation
Each tool validated against: agent's TOOLS.md (capability), shared/tools/registry.md (auth status), shared/tools/<tool>.md (execute + measure docs). Agents can propose with [ ] tools. Experiment can't be approved until all are [x].

### 3. Never Stop + Auto-Execute
Approval = go. Agent picks up on heartbeat. Re-validates tools before every action. Loops until terminal decision. Pauses automatically on tool failure, resumes when fixed.

## What Changed

### Protocol (Railway volume)
- `experiments.md` — merged canonical version with new program.md template, Eval Method (renamed from Eval Harness), Decision Triggers section, never-stop rule
- `autoresearch.md` — now a redirect to experiments.md
- `reddit-browser.md` — added Measure section (browser scrape + Supabase UTM)

### Server (src/server.js)
- `parseExperimentMeta()` — now extracts playbook, eval_method, decision_triggers, constraints
- Approval detail + experiment detail endpoints return structured fields
- Create experiment endpoint accepts structured fields, assembles program.md

### Dashboard
- **CreateExperiment** — 4 separate textareas (Playbook, Eval Method, Decision Triggers, Constraints) replace single Program field
- **ApprovalDetail** — each section renders as a distinct card with its own icon
- **ExperimentDetail** — same structured cards + Required Tools checklist (was deferred, now shipped)
- Legacy backward compatibility: old experiments still render as single "Experiment Plan" card

### API (dashboard/src/api.js)
- `createExperiment()` — accepts playbook, eval_method, decision_triggers, constraints fields

## Key Decisions

| Decision | Chosen | Alternative | Why |
|---|---|---|---|
| Eval Harness renamed to Eval Method | Eval Method | Keep Eval Harness | Clearer language for non-ML domains |
| Playbook before Required Tools in template | Yes | Tools first | Read what the experiment does, then check tooling |
| program.md sections order | Theme > Hypothesis > Proxy Metrics > Playbook > Required Tools > Eval Method > Decision Triggers > Constraints | Various | Natural review flow: what > how > measure > decide > guardrails |
| Protocol merge | experiments.md is canonical | Keep two files | 80% overlap was causing drift |
| Agents can propose with [ ] tools | Allowed | Hard-blocked | Kavin sees full plan, resolves tooling on his side |
| Pause decision value | Added with inbox notification | Agent just stops | Makes tool failures visible without watching Telegram |
| Re-validate tools before every action | Yes | Only at experiment start | Prevents silent failures mid-schedule |

## Out of Scope (Deferred)

- Edit experiment screen (agents write program.md directly)
- Proxy metric progress bars on Strategy tab
- Agent protocol update for cost governance + model routing
