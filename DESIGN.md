# Design System — Mission Control

## Product Context
- **What this is:** An ops dashboard for managing AI agent teams — projects, budgets, approvals, activity, costs, and org structure.
- **Who it's for:** Kavin (single operator) managing a fleet of AI agents across multiple projects.
- **Space/industry:** AI agent orchestration. Closest peers: Paperclip, Linear (for density/hierarchy), Vercel dashboard (for restraint).
- **Project type:** Internal ops dashboard. Dark mode only. Desktop-first, PWA-capable.

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian
- **Decoration level:** Minimal — zero decorative elements. No gradients, blobs, illustrations, or ornament. Every pixel conveys information.
- **Mood:** A control surface. Serious, dense, trustworthy. Closer to a Bloomberg terminal than a Notion doc. The dashboard communicates authority through restraint — it doesn't need to sell you on anything.
- **Reference sites:** Paperclip (same category), Linear (density/hierarchy), Vercel dashboard (dark-mode restraint).
- **Zoom:** Removed. Base font-size set to `19.2px` on body (equivalent to 16px × 1.2) to avoid scroll calculation issues caused by CSS zoom.

## Typography
- **Display/Hero:** System sans (`-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif`) — native feel on Mac, zero loading overhead.
- **Body:** System sans (same stack). `text-[14px]` for most UI text, `text-[15px]` for sidebar items, breadcrumbs, buttons, tabs, and secondary cells.
- **UI/Labels:** System mono (`"SF Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas`) for micro-labels: `text-[11px] uppercase tracking-[0.15em] font-mono`. This is the signature typographic choice — military/industrial micro-labels.
- **Data/Tables:** System mono with `tabular-nums` for all numbers, budgets, costs, timestamps, issue counts.
- **Code:** Same mono stack. `text-xs` (12px) for inline code, `text-sm` for code blocks.
- **Loading:** None — system fonts only. Zero FOUT, zero latency.
- **Scale:**
  - Page entity name: `text-[30px] font-semibold leading-none tracking-tight` — commands the page
  - Page title (list pages): `text-[16px] font-semibold uppercase tracking-[0.2em]` — distinct from section headers
  - Card section header: `text-[14px] font-semibold text-foreground tracking-tight` — inside card header area, not uppercase, not mono
  - Micro-label: `text-[11px] uppercase tracking-[0.15em] font-mono text-muted-foreground` — table column headers, metric labels, form labels, sidebar section labels
  - Body: `text-[14px]`
  - Small: `text-[12px]`
  - Breadcrumb/secondary: `text-[15px]`

## Color
- **Approach:** Restrained — achromatic base with semantic-only accent colors. No brand color. No decorative color.
- **Token mapping:** Use semantic tokens (not hardcoded hex). The Tailwind config maps these:
  - `bg-background` → `oklch(0.145 0 0)` (~`#09090b`) — page background
  - `bg-card` → `oklch(0.205 0 0)` (~`#121214`) — elevated card surfaces
  - `bg-accent` → `oklch(0.269 0 0)` — hover backgrounds, interactive tints
  - `text-foreground` → `oklch(0.985 0 0)` — primary text
  - `text-muted-foreground` → `oklch(0.708 0 0)` — secondary text, labels
  - `border-border` → `oklch(0.269 0 0)` (~`border-zinc-800`) — all borders
  - `ring-ring` → `oklch(0.556 0 0)` — focus rings
- **Semantic badge colors (bordered style):**
  - Active/success: `border-emerald-500/20 bg-emerald-500/10 text-emerald-400`
  - Running/in-progress: `border-indigo-500/20 bg-indigo-500/10 text-indigo-400`
  - Warning/pending: `border-amber-500/20 bg-amber-500/10 text-amber-400`
  - Error/destructive: `border-red-500/20 bg-red-500/10 text-red-400`
  - Proposed/review: `border-violet-500/20 bg-violet-500/10 text-violet-400`
  - Experiment: `border-cyan-500/20 bg-cyan-500/10 text-cyan-400`
  - Completed/deliverable: `border-blue-500/20 bg-blue-500/10 text-blue-400`
  - Neutral/archived: `border-zinc-700/50 bg-zinc-800/50 text-muted-foreground`
- **Dark mode:** Only mode. No light mode. `color-scheme: dark` on html.

## Spacing
- **Base unit:** 4px (Tailwind default)
- **Density:** Compact — information-dense ops dashboard
- **Card internal padding:** `p-[20px]` — card headers, card bodies, metric cards
- **Card header:** `p-[20px] border-b border-border`
- **Table cells:** `px-[20px] py-3.5` — aligns with card header padding
- **Metric card gaps:** `gap-2` (8px) between cards in the grid
- **Section spacing:** `space-y-6` (24px) between top-level sections
- **Content padding:** `p-8` on main content area
- **Sidebar width:** `w-60` (240px) fixed
- **Form field spacing:** `space-y-6` between fields

## Layout
- **Approach:** Grid-disciplined
- **Structure:** Fixed sidebar (240px) + scrollable content area. Full viewport height (`h-dvh`).
- **Grid:** `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` for metric cards. Data tables for lists.
- **Max content width:** `max-w-[1400px] mx-auto` for most pages. `max-w-4xl` for form/approval pages. `max-w-6xl` for detail pages with sidebars.
- **Detail page layout:** `grid grid-cols-1 xl:grid-cols-3 gap-6` — left column `xl:col-span-2`, right column `xl:col-span-1`.

## Border Radius
- **Cards, sections, banners:** `rounded-[2px]` — minimal softening
- **Buttons, inputs, textareas, dropdowns, nav items:** `rounded-[6px]` — soft interactive elements
- **Status badges, pills:** `rounded-full` — semantically circular
- **Sidebar project dots:** `rounded-[2px]` on `w-1.5 h-1.5`
- **Dropdown menus:** `rounded-[6px]` with `shadow-lg`
- **Never:** `rounded-lg` — too bubbly, reads as AI-generated

## Borders & Shadows
- **Card borders:** `border border-border` (1px)
- **Row dividers:** `border-b border-border/50`
- **Card shadows:** `shadow-sm` — subtle depth in dark mode
- **Dropdown shadows:** `shadow-lg`
- **No shadows on:** flat elements, rows, buttons
- **Focus rings:** `focus:ring-[3px] focus:ring-ring/50` — 3px at 50% opacity on `:focus-visible`

## Motion
- **Approach:** Minimal-functional
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` for enter animations. `ease` for simple transitions.
- **Duration:** `transition-colors` on hover/focus (150ms). Activity row enter: 520ms with blur. Chevron rotation: 150ms.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables keyframe animations.
- **Rules:** No decorative animation. No loading spinners beyond `animate-pulse` on skeletons. No page transitions.

## Component Patterns

### Cards
- Default: `bg-card border border-border rounded-[2px] shadow-sm`
- Card body: `p-[20px]`
- Elevated (primary status): `border-l-2 border-l-{color} bg-accent/20` — max one per view

### Card Section Headers (Tinted)
Every card section header uses a colored tinted pattern — icon in a circle badge, tinted background, colored title text:
```
<div class="flex items-center gap-3 px-5 py-3 bg-{color}-500/[0.02] transition-colors">
  <div class="w-6 h-6 rounded-full bg-{color}-500/10 border border-{color}-500/20 flex items-center justify-center">
    <Icon class="w-3.5 h-3.5 text-{color}-400" />
  </div>
  <div class="text-[15px] font-medium text-{color}-100">Title</div>
</div>
```

**Color assignments by meaning:**
| Color | Sections |
|-------|----------|
| Indigo | Mission, NSM, Themes, Project Details form, Edit Issue, Description, Project Progress |
| Cyan | Sub-agents, Hypothesis, Program, Run History, New Experiment |
| Amber | Approval Gates, Budget/Costs, all approval cards, Pending Approvals (inbox) |
| Emerald | Standups (inbox + project) |
| Violet | Recent Issues, New Issue form |
| Blue | Comments |
| Red | Budget Alerts (inbox) |

**Rules:**
- Neutral info cards (Details sidebar with Status/Lead/Budget) do NOT get tinted headers
- The `border-b` is removed from tinted headers — the tint creates visual separation
- Count badges use matching colors: `text-[10px] font-mono bg-{color}-500/10 border border-{color}-500/20 px-1.5 py-0.5 rounded-[2px] text-{color}-400`

### Status Badges
- Pill shape: `rounded-full px-2.5 py-0.5 text-[11px] font-medium`
- Bordered: `border border-{color}-500/20 bg-{color}-500/10 text-{color}-400`
- Approval type badges: `font-normal` (lighter weight than status badges)

### Metric Cards
- Value: `text-[30px] font-semibold leading-none tracking-tight tabular-nums`
- Label: `text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground`
- Padding: `p-[20px]`
- Hover: `hover:bg-accent/30`

### Breadcrumbs
- Separator: `›` in `text-muted-foreground/40`
- Current page: `text-[15px] font-semibold text-foreground`
- Ancestor links: `text-[15px] text-muted-foreground hover:text-foreground`

### Forms
- Labels: `text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2 block`
- Inputs: `rounded-[6px] border border-border bg-background text-[14px] px-3 py-2 focus:ring-[3px] focus:ring-ring/50`
- Selects: same as inputs with `appearance-none` and chevron overlay
- Helper text: `text-[12px] text-muted-foreground mt-1.5`
- Cancel button: `rounded-[6px] border border-border bg-card text-[15px] font-medium text-muted-foreground hover:bg-accent`
- Submit button: `rounded-[6px] border border-emerald-500/50 bg-emerald-500/10 text-[15px] font-medium text-emerald-300 hover:bg-emerald-500/20`

### Tables
- Container: `w-full text-left border-collapse whitespace-nowrap`
- Header: `text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground font-normal pb-3 px-[20px] pt-4 border-b border-border`
- Rows: `border-b border-border/50 hover:bg-accent/40 transition-colors cursor-pointer`
- Cells: `px-[20px] py-3.5`
- No zebra striping

### Sidebar
- Brand header: `h-[60px] border-b border-border`
- Nav container: `p-4 space-y-6`
- Section labels: `text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2 px-2`
- Nav items: `px-2 py-1.5 rounded-[6px] text-[15px] font-medium`
- Active: `bg-accent/60 text-foreground`
- Inactive: `text-muted-foreground hover:bg-accent/40 hover:text-foreground`

### Empty States
- Centered with `py-16`
- Icon: 24px, semantic color (e.g. `text-emerald-500`)
- Text: `text-[14px] text-muted-foreground`
- Sub-text: `text-[12px] text-muted-foreground/60`

### Approval Cards
- **Project group card:** `bg-card border border-border rounded-[2px] shadow-[0_2px_8px_rgba(0,0,0,0.3)]` — wraps all approvals for one project
- **Group header:** `flex items-center gap-3 px-5 py-3 border-b border-border` — ShieldCheck icon in amber circle badge, project name as link, item count
- **Card container:** `p-4 space-y-3` inside the group card
- **Individual approval card:** `bg-zinc-900/50 border border-zinc-800/60 rounded-[2px] p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4` — subtly lighter than parent
- Type badge: `rounded-full px-2.5 py-0.5 text-xs font-medium border` with semantic colors
- Title: `text-sm font-medium text-zinc-100`
- Approve button: `rounded-[6px] border border-emerald-500/30 bg-emerald-500/10 text-sm font-medium text-emerald-400 focus:ring-[3px] focus:ring-emerald-500/30`
- Reject button: `rounded-[6px] border border-red-500/30 bg-red-500/10 text-sm font-medium text-red-400 focus:ring-[3px] focus:ring-red-500/30`

### Theme & Proxy Metric Pills (Approval Cards)
Used on both project-level and global approval cards to show which theme and proxy metric an item targets.
```
<div class="flex flex-wrap items-center gap-2">
  <!-- Theme pill -->
  <div class="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-zinc-800/40 border border-zinc-700/30">
    <div class="w-3.5 h-3.5 rounded-full bg-{color}-500/10 border border-{color}-500/20 flex items-center justify-center text-[9px] font-mono font-medium text-{color}-400">
      {order}
    </div>
    <span class="text-xs text-zinc-300">{theme title}</span>
  </div>
  <!-- Separator -->
  <span class="text-zinc-600 text-sm">›</span>
  <!-- Proxy metric pill -->
  <div class="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-zinc-800/40 border border-zinc-700/30">
    <div class="w-3.5 h-3.5 rounded bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center text-[9px] font-mono text-zinc-500">
      {letter}
    </div>
    <span class="text-xs text-zinc-400">{metric name}</span>
  </div>
</div>
```
- Theme color is derived from theme order using the THEME_COLORS array (indigo, emerald, amber, cyan, rose)
- Letter badge uses `String.fromCharCode(97 + index)` for a, b, c ordering
- Pills sit between title and metadata ("Requested by") line

### Detail Page Headers
- Entity name: `text-[30px] font-semibold text-foreground leading-none tracking-tight`
- Metadata line: `text-[15px] text-muted-foreground` with `·` separators
- Status badge inline with title

### Page Headers (List Pages)
- Sticky: `h-16 flex items-center justify-between px-8 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10`
- Title: `text-[16px] font-medium uppercase tracking-[0.2em]`
- Right side: count or filter controls

## Anti-Patterns (Never Do)

1. **No `rounded-lg` on anything.** Cards: `rounded-[2px]`. Interactive: `rounded-[6px]`. Pills: `rounded-full`.
2. **No gradients.** Not on buttons, backgrounds, or anything.
3. **No decorative color.** Every color maps to a semantic meaning.
4. **No web fonts.** System stack only.
5. **No light mode.** Dark-mode-only product.
6. **No `prompt()` or `alert()`.** Use inline modals (see RejectModal).
7. **No arrow icons on clickable rows.** Hover state + cursor communicate clickability.
8. **No centered section headers.** Left-align everything except empty states.
9. **No hardcoded hex for semantic values.** Use `bg-card` not `bg-[#121214]`, `border-border` not `border-zinc-800`. The semantic tokens map to the same values but keep the system maintainable.
10. **No hardcoded counts.** All numbers derive from data.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-22 | Initial design system created | Codified from shipped dashboard after design review + QA pass |
| 2026-03-22 | System font stack only, no web fonts | Mac-first internal tool. Native feel, zero FOUT, zero latency |
| 2026-03-22 | Semantic-only color, no brand color | Ops dashboard — data speaks, chrome stays quiet |
| 2026-03-22 | Dark mode only | Ops tools live in dark mode |
| 2026-03-22 | 11px uppercase mono micro-labels | Signature typographic choice. Military/industrial feel |
| 2026-03-22 | Entity names at 30px on detail pages | Per Paperclip comparison — names must command the page |
| 2026-03-22 | Cards: `rounded-[2px]`, Interactive: `rounded-[6px]` | Adopted from Aura reference. Subtle softening without being bubbly |
| 2026-03-22 | `shadow-sm` on cards, `shadow-lg` on dropdowns | Adds depth in dark mode. Reversed earlier "no shadows" rule |
| 2026-03-22 | `p-[20px]` standard card padding | Consistent with Aura reference. Generous spacing |
| 2026-03-22 | Semantic tokens over hardcoded hex | `bg-card` not `bg-[#121214]`. Same visual, maintainable system |
| 2026-03-22 | `focus:ring-[3px]` at 50% opacity | Adopted from Paperclip. Polished focus indicator |
| 2026-03-22 | Ported Aura HTML patterns | Approval rows, detail headers, form fields, page headers — all follow Aura reference |
| 2026-03-22 | Themes replace Milestones | Strategic themes on project overview. "Milestones" concept removed |
| 2026-03-22 | Primary Metric → Proxy Metric (dropdown) | Experiments use curated metric list, not freeform text |
| 2026-03-22 | 20% global zoom (`html { zoom: 1.2 }`) | Desktop readability. Everything renders 20% larger |
| 2026-03-22 | Sticky page headers with backdrop blur | `bg-background/80 backdrop-blur-sm` keeps context while scrolling |
| 2026-03-22 | `max-w-4xl` for forms, `max-w-6xl` for details, `max-w-[1400px]` for lists | Content width varies by page density needs |
| 2026-03-23 | Removed `html { zoom: 1.2 }`, set `body { font-size: 19.2px }` | CSS zoom broke scroll calculations on detail pages, clipping bottom content |
| 2026-03-23 | Bumped all `text-[13px]` to `text-[15px]` | Sidebar, breadcrumbs, buttons, tabs, metadata, secondary text — all up 2px for readability |
| 2026-03-23 | Colored tinted card section headers | Every card header gets a semantic color: icon circle + tinted bg + colored title. Inspired by Issues tab theme groups. Adds visual identity without decoration |
| 2026-03-23 | Approval cards nested inside project group card | Cards sit inside a parent project card with drop shadow. Inner cards use `bg-zinc-900/50` to differentiate from `bg-card` parent. Creates visual hierarchy |
| 2026-03-23 | Theme/proxy pills use `rounded-[4px]` box style | Colored number badge for theme, letter badge for proxy metric, `›` separator. Consistent across project and global approvals pages |
