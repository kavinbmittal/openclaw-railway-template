# Project Protocol

This document is the canonical reference for how agents work within projects. Read it when assigned to a project.

## On Project Assignment

1. Read `shared/projects/{your-project}/PROJECT.md` — understand the mission and North Star Metric (NSM).
2. Propose 2-4 **themes** — high-level strategies to chase the NSM. Each theme must include up to 3 proxy metrics.
3. Wait for Kavin to approve your themes before proposing issues or experiments.

## Themes

A theme is a high-level objective or strategy that helps chase the NSM. Examples: "Organic Content Engine", "Partnership Pipeline", "Product-Led Activation."

To propose a theme, write a JSON file to `shared/projects/{slug}/themes/{theme-id}.json`:

```json
{
  "id": "theme-001",
  "title": "Short Theme Name",
  "description": "One-line description of this strategy",
  "status": "proposed",
  "proxy_metrics": [
    {
      "id": "pm-001",
      "name": "Weekly signups from organic channels",
      "description": "New signups where utm_source is organic, social, or community"
    },
    {
      "id": "pm-002",
      "name": "Content pieces published per week",
      "description": "Posts published across all channels"
    }
  ],
  "proposed_by": "your-name",
  "proposed_at": "2026-03-22T10:00:00Z",
  "approved_at": null
}
```

Each theme appears as an approval item in Mission Control. Kavin approves, rejects, or requests revision on each individually.

### Proxy Metric Criteria

Every proxy metric must pass these checks:
1. **Measurable** — can you get a number?
2. **Moveable** — can your work directly influence it?
3. **Not an average** — averages hide problems. Use totals, counts, or rates.
4. **Measures customer/business value** — not vanity metrics.
5. **Not easily gamed** — if you can inflate it without real progress, pick a different metric.

Maximum 3 proxy metrics per theme. This forces focus.

## Issues and Experiments

Every issue and experiment you propose must be tagged to an approved theme and declare which proxy metrics it aims to move.

When proposing an issue, include these fields in the JSON:
```json
{
  "theme": "theme-001",
  "proxy_metrics": ["pm-001", "pm-002"]
}
```

Same for experiment approval requests — include `theme` and `proxy_metrics` in the gate request JSON.

If the project has no approved themes yet, you can propose issues without tags. Once themes are approved, tagging is mandatory.

## Heartbeat

During your heartbeat check:
- Read `shared/projects/{slug}/PROJECT.md` for mission and NSM
- Check `shared/projects/{slug}/themes/` for approved themes
- Check your pending issues and experiments
- Post standup to `shared/projects/{slug}/standups/YYYY-MM-DD.md`
- Log activity to `shared/projects/{slug}/activity.log`

## Key Rules

- Never propose work without connecting it to a theme (once themes exist)
- NSM is set by Kavin — do not modify it
- Themes can be proposed at any time, not just at project start
- If a theme is rejected, read the feedback and propose an alternative
- Max 3 proxy metrics per theme — if you need more, your theme is too broad
