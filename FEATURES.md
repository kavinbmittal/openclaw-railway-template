# FEATURES.md

## Mission Control Dashboard
- View project overview, issues, costs, and agent activity
- Inbox aggregates approvals, budget warnings, standups, and proposed issues
- Unified Approvals page: proposed issues, experiment gates, and deliverable reviews in one view, grouped by project
- Approve or reject any pending item (proposed issue or gate request) from the Approvals page or per-project Approvals tab
- Reject approvals with a reason via inline modal (no more browser prompt)
- Create projects with mission, North Star Metric, lead, budget, and approval gates
- Strategy tab per project: NSM at top, approved themes with proxy metrics, pending theme proposals
- Agents propose themes (with up to 3 proxy metrics each) for individual approval
- Issues and experiments tagged to themes with target proxy metrics
- Keyboard-navigable with visible focus rings on all interactive elements

## Agent Heartbeats
- Agents run 15-minute heartbeat crons to check notifications, update issues, and post standups
- Heartbeat messages include direct dashboard links so agents can reference specific project pages

## Ops Watcher
- Telegram fallback alerts when agents encounter issues

## Budget Management
- Per-project budget policies with automatic agent pausing when exceeded
