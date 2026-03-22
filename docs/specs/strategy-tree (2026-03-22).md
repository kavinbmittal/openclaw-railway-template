# Strategy Tree — NSM, Themes, Proxy Metrics

## What This Means for Users

Every project now has a clear strategy hierarchy: a North Star Metric (set by Kavin at creation), themes (proposed by agents, approved individually), and proxy metrics (bundled with themes, max 3 per theme). Every issue and experiment must be tagged to a theme and declare which proxy metrics it aims to move. No more untagged work — everything ties back to the strategy.

## Problem Being Solved

Agents currently infer project structure on their own. Some write great milestones, some don't. There's no formal connection between "what are we trying to achieve" and "what are agents actually working on." Issues and experiments float without strategic context, making it hard to evaluate whether proposed work is actually moving the needle.

## Approach

Layer a goal-setting framework onto the existing project/approval system:

```
Project
  └── Mission (text, set at creation)
  └── NSM (metric, set at creation)
       └── Theme 1 (proposed by agent, approved by Kavin)
       │    ├── Proxy Metric A
       │    ├── Proxy Metric B
       │    └── Proxy Metric C
       └── Theme 2
            ├── Proxy Metric D
            └── Proxy Metric E
```

Issues and experiments are tagged to themes and declare target proxy metrics.

### Why this approach over alternatives

**Rejected: Milestones as the organizing unit.** Milestones are time-bound and sequential. Themes are parallel strategies that persist — you can have 3 themes running simultaneously. Milestones can coexist as a time-based overlay later, but themes are the structural backbone.

**Rejected: Free-form text milestones with success criteria.** This is what agents do today. It works by accident but doesn't create the tagging structure needed to connect daily work to strategic outcomes.

**Rejected: NSM proposed by agents.** The NSM is the founder's call — it defines what success looks like. Agents figure out how to get there, not where "there" is.

## Scope

### In scope
- NSM field on project creation
- Theme data model (JSON files per theme)
- Theme proposal/approval flow through unified approvals
- Mandatory theme + proxy metric tagging on issues and experiments
- Agent protocol instructions (`shared/protocols/projects.md`)
- Dashboard: create project NSM field, theme approval cards, strategy tree in project detail, theme tagging on issue/experiment proposals
- Project detail: strategy tree view (NSM → themes → proxy metrics with tagged issues/experiments)

### Out of scope
- Proxy metric tracking/visualization (no time-series data yet — that's the "ambitious" follow-on)
- Metric dashboards or charts
- Automated metric collection from Supabase or other sources
- Theme weighting or prioritization scores
- Migration of existing projects (lia-first-100, lia-ship-ready keep their current milestones.md — themes are additive)

## Data Model

### PROJECT.md changes

New field added at creation:
```
**NSM:** [metric definition, e.g. "Number of paying customers with >7 day retention"]
```

### Theme files

Location: `shared/projects/{slug}/themes/{theme-id}.json`

```json
{
  "id": "theme-001",
  "title": "Organic Content Engine",
  "description": "Drive signups through SEO, social, and community content",
  "status": "proposed",
  "proxy_metrics": [
    {
      "id": "pm-001",
      "name": "Weekly signups from organic channels",
      "description": "New signups where utm_source is organic, social, or community",
      "measurable": true,
      "not_average": true
    },
    {
      "id": "pm-002",
      "name": "Content pieces published per week",
      "description": "Posts published across all channels (X, LinkedIn, Reddit, blog)",
      "measurable": true,
      "not_average": true
    }
  ],
  "proposed_by": "leslie",
  "proposed_at": "2026-03-22T10:00:00Z",
  "approved_at": null
}
```

Status values: `proposed` → `approved` | `rejected` | `revision_requested`

### Issue and experiment tagging

Issues (`shared/projects/{slug}/issues/*.json`) gain:
```json
{
  "theme": "theme-001",
  "proxy_metrics": ["pm-001", "pm-002"]
}
```

Both fields required when proposing (only enforced when the project has at least one approved theme — projects with no themes yet allow untagged work). Experiments gain the same fields in their approval request JSON.

## Approval Flow

### Theme proposals

- Agent reads PROJECT.md (mission + NSM), proposes themes
- Each theme is a separate approval item: `_source: "theme"`, type badge "Theme" (new color — teal)
- Approval detail shows: theme name, description, and proxy metrics as a structured list
- Approve → status moves to `approved`, agent can tag work to it
- Reject → theme file deleted
- Request revision → agent gets feedback, resubmits

### Issue/experiment proposals with tagging

- When proposing an issue or experiment, agent must include `theme` and `proxy_metrics`
- Approval card shows theme name and target metrics prominently (below title, above description)
- If agent proposes work without a theme tag → validation error, proposal rejected by the system

## Agent Protocol

`shared/protocols/projects.md` will instruct agents:

1. On project assignment, read PROJECT.md — understand mission and NSM
2. Propose 2-4 themes with up to 3 proxy metrics each as approval items
3. Wait for theme approval before proposing issues/experiments
4. Every issue and experiment must declare its theme and which proxy metrics it targets
5. Proxy metric criteria: measurable, moveable, not an average, measures customer/business value, not easily gamed

## Dashboard Changes

### Create project form
- New "North Star Metric" field between Mission and Lead
- Help text: "How do you measure progress against this mission? Combine quantity and quality."

### Approvals
- New "Theme" type badge (teal)
- Theme detail page: structured card showing theme name, description, proxy metrics as a list with descriptions
- Approve/reject/revise as usual

### Project detail
- New "Strategy" tab (or section in Overview): NSM at top, approved themes below, each with its proxy metrics
- Click a theme → see all issues and experiments tagged to it
- Issues and experiments show their theme tag as a badge

### Issue/experiment proposals
- Theme and proxy metrics shown prominently in approval cards
- Structured display: "Theme: Organic Content Engine → Targeting: Weekly signups, Content velocity"

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| NSM set by Kavin, not agents | Founder defines the target | The NSM is a strategic call, not a tactical one |
| Themes proposed individually | Each theme is its own approval | Allows partial approval — approve 2 of 3 themes |
| Proxy metrics bundled with themes | Come as a package | Metrics without a theme are meaningless; theme without metrics is unmeasurable |
| Max 3 proxy metrics per theme | Hard limit | Prevents metric sprawl, forces focus |
| Theme + metric tagging mandatory | System rejects untagged proposals | Ensures every piece of work connects to strategy |
| Themes as JSON files | Not in PROJECT.md | Themes have lifecycle (proposed/approved/rejected) and are referenced by ID from issues/experiments |
| No migration of existing projects | Additive | Existing milestones.md continues to work; themes layer on top |
| Theme tagging grace period | Required only when project has ≥1 approved theme | Avoids breaking existing projects with no themes yet |
| Theme has title + description | Title shows everywhere, description only on project strategy view | Keeps approval cards compact, detail available where needed |
| Themes scanned from themes/ dir | Not from approvals/pending/ | Themes have lifecycle beyond approval (stay as approved, referenced by ID) — more like issues than gates |
| Build order: UI first with mock data, then backend | Confirm experience before wiring | Avoids rework if UI needs change |
