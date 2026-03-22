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

## Typography
- **Display/Hero:** System sans (`-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif`) — native feel on Mac, zero loading overhead. Entity names (agent name, project name on detail pages) use `text-2xl font-semibold` (24px).
- **Body:** System sans (same stack) at 15px base. `text-sm` (14px) for most UI text, `text-[13px]` for sidebar items and breadcrumbs.
- **UI/Labels:** System mono (`"SF Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas`) for section headers: `text-[11px] uppercase tracking-[0.16em] font-medium font-mono`. This is the signature typographic choice — military/industrial micro-labels.
- **Data/Tables:** System mono with `tabular-nums` for all numbers, budgets, costs, timestamps, issue counts. Ensures columns align.
- **Code:** Same mono stack. `text-xs` (12px) for inline code, `text-sm` for code blocks.
- **Loading:** None — system fonts only. Zero FOUT, zero latency.
- **Scale:**
  - Page entity name: `text-3xl font-semibold` (30px) — commands the page
  - Page title (list pages): `text-base uppercase tracking-wider` (16px) — distinct from section headers
  - Section header: `text-sm font-semibold` (14px) — no uppercase, no mono. Used on h3/h4 section titles.
  - Micro-label: `text-[11px] uppercase tracking-[0.16em] font-mono` (11px) — table column headers, metric card labels, form labels, sidebar section labels, budget breakdown labels
  - Body: `text-sm` (14px)
  - Small: `text-xs` (12px)

## Color
- **Approach:** Restrained — achromatic base with semantic-only accent colors. No brand color. No decorative color.
- **Background:** `oklch(0.145 0 0)` — near-black, zero chroma
- **Card/elevated:** `oklch(0.205 0 0)` — subtle lift from background
- **Secondary/muted:** `oklch(0.269 0 0)` — borders, inputs, accent backgrounds
- **Foreground:** `oklch(0.985 0 0)` — near-white
- **Muted foreground:** `oklch(0.708 0 0)` — secondary text, labels
- **Ring (focus):** `oklch(0.556 0 0)` — visible but not distracting
- **Semantic colors:**
  - Active/success: green (`bg-green-400`, badge: `bg-green-900/50 text-green-300`)
  - Running/in-progress: cyan (`bg-cyan-400`, badge: `bg-cyan-900/50 text-cyan-300`)
  - Warning/pending: amber (`bg-amber-400`, badge: `bg-amber-900/50 text-amber-300`)
  - Error/destructive: red (`bg-red-400`, badge: `bg-red-900/50 text-red-300`, solid: `oklch(0.577 0.245 27.325)`)
  - Proposed/review: violet (`bg-violet-900/50 text-violet-300`)
  - Completed: blue (`bg-blue-900/50 text-blue-300`)
- **Dark mode:** Only mode. No light mode. `color-scheme: dark` on html.

## Spacing
- **Base unit:** 4px (Tailwind default)
- **Density:** Compact — this is an information-dense ops dashboard
- **Scale:** `gap-0.5`(2) `gap-1`(4) `gap-2`(8) `gap-3`(12) `p-4`(16) `p-6`(24) `space-y-6`(24) between major sections
- **Metric card gaps:** `gap-1 sm:gap-2` (4-8px) — intentionally tight
- **Section spacing:** `space-y-6` (24px) between top-level sections
- **Content padding:** `p-4 md:p-6` on main content area
- **Sidebar width:** `w-60` (240px) fixed

## Layout
- **Approach:** Grid-disciplined
- **Structure:** Fixed sidebar (240px) + scrollable content area. Full viewport height (`h-dvh`).
- **Grid:** `grid-cols-2 xl:grid-cols-4` for metric cards. `grid-cols-2 sm:grid-cols-3` for smaller card sets. Data tables for project lists.
- **Max content width:** None — content fills available space. Tables and cards reflow responsively.
- **Border radius:**
  - **Cards and sections: `rounded-sm`** (2px) — subtle softening. Not bubbly, not razor sharp.
  - **Buttons, inputs, textareas, dropdowns: `rounded-md`** (6px) — soft interactive elements, matches Paperclip.
  - **Exception: `rounded-full`** — status dots, badge pills. Semantically circular.
  - **Exception: `rounded-sm`** — sidebar project dots (small color squares).
  - **Never: `rounded-lg`** — too bubbly, reads as AI-generated.
- **Borders:** `border border-border` (1px, `oklch(0.269 0 0)`) on all cards and sections.
- **Shadows:** `shadow-sm` on cards for subtle depth. `shadow-lg` on dropdown menus. No shadows on flat elements.
- **Card background:** `bg-card` (full opacity) — distinct from page background. Creates clear card boundaries.
- **Focus rings:** `box-shadow: 0 0 0 3px oklch(0.556 0 0 / 0.5)` — 3px ring at 50% opacity on `:focus-visible`.
- **Responsive strategy:** Hide table columns at breakpoints (`hidden sm:table-cell`, `hidden lg:table-cell`). Touch targets enforced at 44px via `@media (pointer: coarse)`.

## Motion
- **Approach:** Minimal-functional
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` for enter animations (spring-like overshoot). `ease` for simple transitions.
- **Duration:** `transition-colors` on hover/focus (150ms default). Activity row enter: 520ms with blur+overshoot. Chevron rotation: 150ms.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables all keyframe animations. Transitions remain (they're too subtle to cause issues).
- **Rules:** No decorative animation. No loading spinners beyond `animate-pulse` on skeletons. No page transitions. Motion exists only to communicate state changes.

## Component Patterns

### Cards
- Default: `bg-card rounded-sm border border-border shadow-sm p-5` — full card background, soft corners, subtle shadow, generous padding
- Elevated (primary status): `bg-card rounded-sm border border-border shadow-sm border-l-2 border-l-{color} bg-accent/20 p-5` — left accent border + tinted background. Use for the single most important section on a page (e.g., "Current Work" on agent detail).
- Never more than one elevated card per view.

### Status Badges
- Pill shape: `rounded-full px-2.5 py-0.5 text-xs font-medium`
- Color: semantic background at 50% opacity + 300-level text (e.g., `bg-green-900/50 text-green-300`)
- 20+ status mappings defined in `StatusBadge.jsx`

### Metric Cards
- Large number: `text-2xl sm:text-3xl font-semibold tabular-nums`
- Label below: `text-[11px] uppercase tracking-[0.16em] text-muted-foreground`
- Monetary values: `font-mono` for tabular alignment

### Breadcrumbs
- Separator: `›` (right single guillemet) in `text-muted-foreground/40`
- Back link: `text-[13px] text-muted-foreground` with arrow icon
- Current page: `text-[13px] font-semibold text-foreground`

### Empty States
- Centered vertically with `py-16`
- Icon in `bg-muted/50 p-3` container (no border-radius — matches zero-radius system)
- Primary text: `text-sm text-muted-foreground`
- Secondary text: `text-xs text-muted-foreground/60`

### Tables
- Header: `text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground/60` (the micro-label pattern)
- Rows: `hover:bg-accent/50 transition-colors cursor-pointer`
- Dividers: `divide-y divide-border`
- No zebra striping. Hover state is sufficient.

### Sidebar
- Section labels: `text-[11px] uppercase tracking-widest font-mono text-muted-foreground/80`
- Nav items: `text-[13px] font-medium` with `h-4 w-4` icons
- Active: `bg-accent text-foreground`
- Hover: `bg-accent/50`
- Project items: colored dot (`h-3.5 w-3.5 rounded-sm`) + name

## Anti-Patterns (Never Do)

1. **No `rounded-lg` on anything.** Cards use `rounded-sm` (2px). Buttons/inputs/dropdowns use `rounded-md` (6px). `rounded-full` for pills and dots only.
2. **No gradients.** Not on buttons, not on backgrounds, not on anything.
3. **No decorative color.** Every color must map to a semantic meaning.
4. **Shadows are intentional.** `shadow-sm` on cards, `shadow-lg` on dropdowns. No shadows on flat elements, rows, or buttons.
5. **No web fonts.** System stack only. Zero loading overhead.
6. **No light mode.** This is a dark-mode-only product.
7. **No `prompt()` or `alert()`.** Native browser dialogs break the visual language. Use inline modals.
8. **No arrow icons on clickable rows.** Hover state + cursor communicate clickability. The arrow is visual noise.
9. **No centered section headers.** Left-align everything except empty states.
10. **No hardcoded counts.** All numbers must derive from data.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-22 | Initial design system created | Codified from shipped dashboard after design review + QA pass. Documents existing opinions rather than inventing new ones. |
| 2026-03-22 | `rounded-sm` on cards, sharp on buttons/inputs | Softened from zero-radius after Paperclip comparison. Cards get 2px warmth, interactive elements stay crisp. No `rounded-md` or `rounded-lg`. |
| 2026-03-22 | System font stack only, no web fonts | Mac-first internal tool. Native feel, zero FOUT, zero latency. SF Pro + SF Mono. |
| 2026-03-22 | Semantic-only color, no brand color | Ops dashboard — data speaks, chrome stays quiet. Every hue maps to a status meaning. |
| 2026-03-22 | Dark mode only | Ops tools live in dark mode. No light mode planned or needed. |
| 2026-03-22 | 11px uppercase mono micro-labels | Signature typographic choice. Military/industrial feel. Used for table headers, metric labels, form labels, sidebar labels. Section headers upgraded to 14px semibold. |
| 2026-03-22 | Left-border accent for primary status cards | Differentiates the most important section from uniform bordered boxes. Max one per view. |
| 2026-03-22 | Entity names at 30px on detail pages | Per Paperclip comparison — entity names must command the page. Bumped from 24px to 30px for more presence. |
| 2026-03-22 | Card background lift with `bg-card/50` | Subtle depth without shadows. Cards are visually distinct from page background. |
| 2026-03-22 | Card padding increased to `p-5` | More breathing room inside cards. Inspired by Paperclip's generous spacing. |
| 2026-03-22 | Section headers split from micro-labels | Section h3/h4 headers now 14px semibold (readable). Micro-labels (11px mono uppercase) reserved for table/metric/form/sidebar labels. |
| 2026-03-22 | `shadow-sm` on cards, `shadow-lg` on dropdowns | Adopted from Paperclip. Adds depth in dark mode without being heavy. Reversed earlier "no shadows" rule. |
| 2026-03-22 | `bg-card` full opacity on cards | Upgraded from `bg-card/50`. Cards are now clearly distinct from page background. |
| 2026-03-22 | `rounded-md` on buttons, inputs, dropdowns | Adopted from Paperclip. Soft interactive elements feel more polished. Cards stay `rounded-sm`. |
| 2026-03-22 | Focus ring: 3px box-shadow at 50% opacity | Adopted from Paperclip. More polished than 1px outline. Uses ring color at half opacity. |
