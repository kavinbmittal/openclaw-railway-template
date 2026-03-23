# FEATURES.md

## Mission Control Dashboard
- View project overview, issues, costs, and agent activity
- Inbox aggregates approvals, budget warnings, standups, proposed issues, and experiment updates
- Unified Approvals page: proposed issues, experiment gates, and deliverable reviews in one view, grouped by project
- Approve, reject, or request revision on any pending item (proposed issue or gate request) from the Approvals page or per-project Approvals tab
- Request revision on proposed issues with feedback — issue stays pending, agent gets notified to revise
- Reject approvals with a required comment via inline modal
- Create projects with mission, North Star Metric, lead, budget, working directory, and approval gates
- Edit projects from a dedicated form page: update name, mission, NSM, lead, status, budget, working directory, and approval gates
- Strategy tab per project: NSM at top, approved themes with proxy metrics, pending theme proposals
- Agents propose themes (with up to 3 proxy metrics each) for individual approval
- Create experiments from the dashboard with name, hypothesis, proxy metric, target value, theme, and program
- Click any experiment card to view full detail: phase arc showing experiment lifecycle (Design → Run → Pivot → Scale), hypothesis, program markdown, decision-aware run history table with colored badges and reasons, metrics sidebar, and action buttons
- Experiment decisions (pivot, scale, kill) appear in the Inbox as Experiment Updates with deep links to the experiment detail page
- Issues grouped by theme in list view with collapsible sections, color-coded headers, proxy metric display, and unthemed fallback group
- Edit issues from a dedicated form page: update title, description, priority, assignee, theme, proxy metrics, labels, and model tier; delete issues from the danger zone
- Issues and experiments tagged to themes with target proxy metrics (server-validated)
- Experiment approvals show structured hypothesis, program, and proxy metric targets
- Click any approved theme to see all issues tagged to it
- Agent comments auto-format: flat text becomes bullet lists with bold status labels, backticked file paths, and comma-separated items split into bullets
- Sticky headers with breadcrumb navigation on all detail pages (projects, issues, agents, approvals, create project)
- Keyboard-navigable with visible focus rings on all interactive elements

## Agent Heartbeats
- Agents run 15-minute heartbeat crons to check notifications, update issues, and post standups
- Heartbeat messages include direct dashboard links so agents can reference specific project pages

## Ops Watcher
- Telegram fallback alerts when agents encounter issues

## Model Routing
- Model Routing page: manage six model tiers (Claude Code, Complex, Strategic, Analyst, Operator, Runner) with model and thinking level per tier
- Assign each agent to a tier — sets their default model for task execution
- Map research loop phases (hypothesis, execution, analysis, synthesis) to tiers
- Set model tier on any issue from create or edit forms — tier drives which model or execution environment runs the task
- Claude Code tier: agents spawn a Claude Code session for full autonomous execution instead of a direct API call
- Agent detail pages show tier badge with resolved model next to agent name
- Routing config saved to Railway volume as `shared/model-routing.json` — agents read it at task creation time

## Budget Management
- Per-project budget policies with automatic agent pausing when exceeded
