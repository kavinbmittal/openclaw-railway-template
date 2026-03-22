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

## v2: One-tap model switch from Telegram

When a model fallback alert fires, include an inline "Switch" button that rewrites `agents.defaults.model.primary` in `openclaw.json` via an HMAC-secured `/ops/model-switch` endpoint. Also add an "Undo" button to the confirmation message so switching back is one more tap.

Deferred because it writes to `openclaw.json` on the live volume — needs careful testing for race conditions and a rollback mechanism before shipping.
