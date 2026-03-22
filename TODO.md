# TODO

## 2026-03-22-unified-approvals
- [x] Backend: `GET /mc/api/approvals` includes proposed issues with `_source: "issue"` and `type` field
- [x] Backend: `GET /mc/api/approvals/:id` resolves proposed issue IDs
- [x] Frontend: ApprovalCard renders proposed issues with type badge, branched approve/reject
- [x] Frontend: ApprovalDetail renders proposed issue detail view
- [x] Frontend: Approvals.jsx groups items by project
- [x] Frontend: ProjectDetail.jsx approvals tab uses unified endpoint (includes proposed issues)
- [x] Frontend: Issues.jsx drops proposed banner
- [x] Frontend: Sidebar badge counts from unified endpoint
- [x] Build dist and commit

## 2026-03-22-strategy-tree

### Phase 1: UI
- [x] CreateProject: add NSM field between Mission and Lead
- [x] ProjectDetail: Strategy tab with NSM, themes, proxy metrics
- [x] ApprovalCard/Detail: Theme type badge (teal), structured theme detail view
- [x] Issue/experiment proposals: theme tag + proxy metrics display
- [x] CreateIssue: theme selector dropdown + proxy metric checkboxes
- [x] Build dist

### Phase 2: Backend wiring
- [x] Backend: scan themes/ dir in GET /mc/api/approvals
- [x] Backend: resolve theme IDs in GET /mc/api/approvals/:id
- [x] Backend: GET /mc/api/themes?project= endpoint
- [x] Backend: theme approve/reject/revise handlers (via frontend resolveTheme)
- [x] Backend: issue validation — enforced via protocol + UI
- [x] Backend: parse NSM from PROJECT.md in project summary
- [x] Wire frontend to real endpoints
- [x] Write protocols/projects.md agent instructions

### Deferred
- [ ] Proxy metric visualization — progress bars, summing contributions vs targets on Strategy tab — effort M
- [x] Port lia-ship-ready to themes — deleted (project completed)
- [x] Proxy metric targets on themes + contribution values on issues/experiments

## 2026-03-22-nsm-proxy-upgrade

### Protocol updates (Railway SSH)
- [x] Update projects.md — 7 changes (milestones → themes, strategy tree section, experiment format, etc.)
- [x] Update experiments.md — add theme/proxy_metrics to program.md template
- [x] Update claude-code.md — milestones → themes reference
- [x] Update all 10 AGENTS.md files — approval tip line ("what"/"why" → "title")
- [x] No existing experiment gates to port (clean slate)

### Dashboard
- [x] ApprovalDetail: render experiment hypothesis, program, theme, proxy metric targets
- [x] Fallback: old experiments with `why` field still render
- [x] Server: resolve theme/metric names on experiment gates
- [x] Build dist

## 2026-03-23-agent-model-routing

### Phase 1: Backend
- [x] API: GET/PUT `/mc/api/model-routing` — read/write `shared/model-routing.json`
- [x] API: Issue POST/PATCH accept `model_override`, `thinking_override`, `complexity`, `escalation_count`

### Phase 2: Routing Config page
- [x] New `ModelRouting.jsx` page — tier definitions, agent assignments, research phase mapping
- [x] Add route in App.jsx + sidebar nav item

### Phase 3: Issue forms
- [x] CreateIssue: add complexity, model override, thinking override dropdowns
- [x] EditIssue: add same fields + read-only escalation count
- [x] IssueDetail: display model/complexity info
- [x] API client: add `getModelRouting`, `updateModelRouting` functions

### Phase 4: Agent detail + costs
- [x] AgentDetail: tier badge next to agent name
- [~] Costs: model tier breakdown — blocked, depends on agents logging `model` field in cost entries (v2)

### Phase 5: Build + verify
- [x] Build dist

## v2: Agent Model Routing

- [ ] Escalation logic — agents increment `escalation_count` on issue JSON, retry at next tier up (simple→complex→lead→coordinator). Requires agent protocol update. — effort M
- [ ] Agent protocol update — teach agents to read `shared/model-routing.json` and issue model/thinking fields at spawn time. Separate OpenClaw workspace deliverable. — effort M
- [ ] Experiment-level model override — override model for an entire research loop, not just per-issue. — effort S
- [ ] Escalation pattern insights — surface patterns like "26% of Leslie's research tasks escalate from Haiku". Depends on escalation data existing first. — effort L

## v2: One-tap model switch from Telegram

When a model fallback alert fires, include an inline "Switch" button that rewrites `agents.defaults.model.primary` in `openclaw.json` via an HMAC-secured `/ops/model-switch` endpoint. Also add an "Undo" button to the confirmation message so switching back is one more tap.

Deferred because it writes to `openclaw.json` on the live volume — needs careful testing for race conditions and a rollback mechanism before shipping.
