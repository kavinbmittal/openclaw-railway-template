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
- [ ] Proxy metric tracking/visualization (time-series, charts) — effort M
- [ ] Port lia-ship-ready to themes — effort S
- [ ] v2: Proxy metric targets on themes — themes define target values for each proxy metric (e.g. "Weekly signups: 200/week"), issues and experiments aim to hit or beat those targets across multiple instances. Aggregated view on Strategy tab shows progress toward theme-level targets. — effort M

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

## v2: One-tap model switch from Telegram

When a model fallback alert fires, include an inline "Switch" button that rewrites `agents.defaults.model.primary` in `openclaw.json` via an HMAC-secured `/ops/model-switch` endpoint. Also add an "Undo" button to the confirmation message so switching back is one more tap.

Deferred because it writes to `openclaw.json` on the live volume — needs careful testing for race conditions and a rollback mechanism before shipping.
