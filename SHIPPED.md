# SHIPPED.md

## 2026-03-26
- **fix:** Only leads post standups — strengthened heartbeat message so agents skip projects they don't lead; deleted fake `standups` project directory; all project endpoints now require PROJECT.md to exist (stray directories ignored); cleaned up non-lead standup files from lia-first-100
- **fix:** Heartbeat cron now explicitly tells agents only leads post standups; `_org-level` filtered from all project-listing endpoints (sidebar, costs, approvals, agents — not just inbox)
- **feat:** Blocked-on-operator detection — agents can flag when they're waiting on you (`blocked_on: "operator"`); shows in Briefing Section 1 with orange badge, inline reason text, and agent name; API scans issues for blocker fields
- **feat:** Project-grouped Briefing — all three sections now group items by project with lightweight sub-headers; projects sorted by urgency (oldest item first); items within a project sorted oldest-first
- **feat:** Briefing page replaces Inbox — three priority-ordered sections (Decisions Waiting, Risks, What Happened) with decreasing visual weight; elevated card with red/amber accent for decisions, standard card for risks, muted rows for context; new overdue issue and paused experiment detection in API; sidebar badge counts only actionable items (Sections 1+2); `#/inbox` aliases to `#/briefing`

## 2026-03-25
- **fix:** Only project leads post standups — protocol updated, non-lead agents skip standup writes; inbox groups standups by project+date (no more 24 duplicate rows); `_org-level` filtered from inbox
- **feat:** Issue target dates — agents can propose a due date when creating issues, editable from the dashboard; issues list shows friendly relative text ("overdue" in red, "today"/"tomorrow" in amber, "in X days" in gray); issue detail shows target date in header metadata and sidebar; create and edit forms include a date picker field

## 2026-03-24
- **feat:** Edit Strategy modal — restructure project themes mid-flight from the Overview tab: inline edit theme titles/descriptions/caps, add/remove proxy metrics (min 1, max 3), add new themes, retire old ones; two-step flow with impact review showing affected issues/experiments with keep/discard checkboxes; crash-safe write order (notification → themes → cascade → archive → activity log); agent reconciliation via heartbeat notification
- **feat:** Merged autoresearch + experiments into single canonical protocol — eval harness per domain, never-stop iteration rule, three-check tool validation (agent TOOLS.md + registry + tool doc), auto-execute on approval, pause/resume on tool failure

## 2026-03-23
- **feat:** Autoloop experiments — Required Tools checklist on experiment approvals (green/red per tool), approve blocked until all tools verified; `pause` experiment decision with orange badge, pulsing dot, phase arc node, and inbox notification; Required Tools stripped from plan markdown to avoid duplication
- **feat:** Edit Project page — edit name, mission, NSM, lead, status, budget, workdir, and approval gates; "Edit" button on project detail header
- **feat:** Issue rows show proxy metric letter pills (a, b, c) to the left of status badges, so you can see which metrics each issue contributes to at a glance
- **feat:** Proxy metrics on Issues page now show target values (→ target) matching the overview page
- **feat:** Agent comments auto-format into bullet lists — flat text becomes structured with bold labels, bullets for sentences and comma lists, backticked file paths; comment timestamps now display correctly
- **refactor:** Ship-ready cleanup — removed dead milestones code, 4 unused components, dead getDashboard endpoint, unused CSS animation, fixed variable typos, deleted stale spec docs (919 lines removed)
- **feat:** Experiment journal — phase arc (Design → Run → Pivot → Scale), decision-aware run history table with colored badges, status derived from results.tsv, inbox Experiment Updates category with deep links to experiment detail (`988eecf`)
- **feat:** Working directory per project — set a local path on project create, shown on project detail, passed to Claude Code agent as `workdir` for task execution
- **feat:** Claude Code tier — agents can now be assigned to spawn Claude Code sessions for full autonomous execution; six tiers: Claude Code > Complex > Strategic > Analyst > Operator > Runner (`dba260f`)
- **refactor:** Model routing simplified — removed model/thinking overrides from issues, single tier dropdown, reordered routing page sections (`fa5fb7e`)
- **fix:** Global approvals pills now show colored number badge for theme + letter badge for proxy metric, matching project approvals exactly
- **fix:** Auto-bold known labels in agent descriptions (what:, why:, etc.) so they render cleanly regardless of agent formatting
- **feat:** Request revision on proposed issues — leave feedback instead of just approve/reject, issue stays pending with comment attached, agent gets notified
- **fix:** Rejecting a proposed issue now requires a comment
- **feat:** Agent model routing — Routing Config page to manage model tiers, agent assignments, and research phase mapping; model/thinking/complexity override on issues; tier badge on agent detail
- **style:** Rewrite Inbox page to Aura grouped cards layout — items grouped by category (Pending Approvals, Budget Alerts, Stale Tasks, Standups) with section cards, compact rows, short timestamps, empty states; removed tabs and inline approve/reject buttons

## 2026-03-22
- **feat:** Edit Issue page — full form with Aura HTML classes, pre-populated fields, theme/proxy metric selection, danger zone delete, change tracking with save/cancel
- **style:** Port exact Aura HTML classes to Issues and Experiments tabs — filter selects, buttons, experiment card radius, hypothesis text size, and theme header hover classes all match reference HTML literally (`0131b25`)
- **style:** Issues tab groups by theme with collapsible sections, colored badges, and proxy metric display; experiment cards show "Hypothesis:" prefix, proxy metric name, and "Propose New Experiment" empty-state card
- **feat:** Experiment detail page — click any experiment card to see full hypothesis, program (rendered as markdown), run history table with best-run highlighting, metrics sidebar, and action buttons
- **fix:** Clicking approval rows now navigates to approval detail instead of dashboard; sticky headers on all detail pages (IssueDetail, AgentDetail, ProjectDetail, CreateProject, ApprovalDetail)
- **feat:** NSM/proxy upgrade — agent protocols replaced milestones with strategy tree (themes + proxy metrics), structured experiment format (hypothesis/program/targets), dashboard renders new experiment fields
- **feat:** Create experiments from dashboard — POST endpoint, API client, wired form, auto-generates exp-NNN directories with program.md
- **fix:** Experiment cards now show hypothesis instead of full program.md, with compact Aura-style layout and run counts
- **style:** Use exact Aura HTML classes on CreateExperiment, IssueDetail, ApprovalDetail, CreateProject — replaced semantic tokens with literal Tailwind values from reference
- **fix:** Strategy tree enforcement — theme/proxy_metrics persisted on issues, server validates tags against approved themes, theme drill-down shows tagged issues
- **feat:** Strategy tree — projects now have NSM, themes, and proxy metrics. Agents propose themes for approval, all work tagged to themes
- **fix:** Approve/reject buttons now show on proposed issues
- **fix:** Internal `_org-level` project hidden from dashboard
- **feat:** Paperclip-inspired visual refinements — card shadows, rounded-md on buttons/inputs, bigger entity names, upgraded section headers, 3px focus rings
- **fix:** Design system enforcement pass — 9 fixes: removed all remaining rounded corners, shadows, gradients, added font-mono to all micro-labels, neutralized decorative colors
- **feat:** Design system overhaul — 16 fixes: typography hierarchy, zero-radius consistency, focus rings, rejection modal, agent header rebalance
- **docs:** DESIGN.md created — codifies the shipped design system as source of truth
- **feat:** Unified approvals — proposed issues, experiment gates, and deliverables all surface in one Approvals page grouped by project
- **fix:** Dashboard base font bumped from 15px to 16px
- **feat:** Aura-ported design overhaul — metric cards, tables, status badges, sidebar, and scrollbar all use Aura HTML classes directly (`d285ea9`)

## 2026-03-21
- **fix:** Agent heartbeat messages now include direct dashboard links when proposing issues (`pending`)
