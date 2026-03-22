# SHIPPED.md

## 2026-03-22
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
