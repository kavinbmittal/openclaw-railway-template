# FEATURES.md

## Mission Control Dashboard
- View project overview, issues, costs, and agent activity
- Inbox aggregates approvals, budget warnings, standups, and proposed issues
- Unified Approvals page: proposed issues, experiment gates, and deliverable reviews in one view, grouped by project
- Approve, reject, or request revision on any pending item (proposed issue or gate request) from the Approvals page or per-project Approvals tab
- Request revision on proposed issues with feedback — issue stays pending, agent gets notified to revise
- Reject approvals with a required comment via inline modal
- Create projects with mission, North Star Metric, lead, budget, and approval gates
- Strategy tab per project: NSM at top, approved themes with proxy metrics, pending theme proposals
- Agents propose themes (with up to 3 proxy metrics each) for individual approval
- Create experiments from the dashboard with name, hypothesis, proxy metric, target value, theme, and program
- Click any experiment card to view full detail: hypothesis, program markdown, run history table with best-run highlighting, metrics sidebar, and action buttons
- Issues grouped by theme in list view with collapsible sections, color-coded headers, proxy metric display, and unthemed fallback group
- Edit issues from a dedicated form page: update title, description, priority, assignee, theme, proxy metrics, labels, model override, thinking override, and complexity; delete issues from the danger zone
- Issues and experiments tagged to themes with target proxy metrics (server-validated)
- Experiment approvals show structured hypothesis, program, and proxy metric targets
- Click any approved theme to see all issues tagged to it
- Sticky headers with breadcrumb navigation on all detail pages (projects, issues, agents, approvals, create project)
- Keyboard-navigable with visible focus rings on all interactive elements

## Agent Heartbeats
- Agents run 15-minute heartbeat crons to check notifications, update issues, and post standups
- Heartbeat messages include direct dashboard links so agents can reference specific project pages

## Ops Watcher
- Telegram fallback alerts when agents encounter issues

## Model Routing
- Model Routing page: manage four model tiers (coordinator, lead, complex, simple) with model and thinking level per tier
- Assign each agent to a tier — sets their default model for task execution
- Map research loop phases (hypothesis, execution, analysis, synthesis) to tiers
- Override model and thinking level on any individual issue from create or edit forms
- Complexity classification on issues (simple, complex, strategic) drives sub-agent model tier
- Agent detail pages show tier badge with resolved model next to agent name
- Routing config saved to Railway volume as `shared/model-routing.json` — agents read it at task creation time

## Budget Management
- Per-project budget policies with automatic agent pausing when exceeded
