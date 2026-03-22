/**
 * StatusBadge — renders a colored pill for any status string.
 * Color map ported from Paperclip's status-colors.ts (dark-mode only).
 */

const STATUS_BADGE = {
 // Agent / project statuses
 active:"border border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
 running:"border border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
 paused:"border border-orange-500/20 bg-orange-500/10 text-orange-400",
 idle:"border border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
 archived:"border border-zinc-700/50 bg-zinc-800/50 text-muted-foreground",

 // Goal / completion
 planned:"border border-zinc-700/50 bg-zinc-800/50 text-muted-foreground",
 achieved:"border border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
 completed:"border border-blue-500/20 bg-blue-500/10 text-blue-400",

 // Run statuses
 failed:"border border-red-500/20 bg-red-500/10 text-red-400",
 timed_out:"border border-orange-500/20 bg-orange-500/10 text-orange-400",
 succeeded:"border border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
 error:"border border-red-500/20 bg-red-500/10 text-red-400",
 terminated:"border border-red-500/20 bg-red-500/10 text-red-400",
 pending:"border border-yellow-500/20 bg-yellow-500/10 text-yellow-400",

 // Approval
 pending_approval:"border border-amber-500/20 bg-amber-500/10 text-amber-400",
 revision_requested:"border border-amber-500/20 bg-amber-500/10 text-amber-400",
 approved:"border border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
 rejected:"border border-red-500/20 bg-red-500/10 text-red-400",

 // Issue statuses
 proposed:"border border-violet-500/20 bg-violet-500/10 text-violet-400",
 backlog:"border border-zinc-700/50 bg-zinc-800/50 text-muted-foreground",
 todo:"border border-blue-500/20 bg-blue-500/10 text-blue-400",
 in_progress:"border border-indigo-500/20 bg-indigo-500/10 text-indigo-400",
 in_review:"border border-violet-500/20 bg-violet-500/10 text-violet-400",
 blocked:"border border-red-500/20 bg-red-500/10 text-red-400",
 done:"border border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
 cancelled:"border border-zinc-700/50 bg-zinc-800/50 text-muted-foreground",

 // Goal statuses
 not_started:"border border-zinc-700/50 bg-zinc-800/50 text-muted-foreground",
 at_risk:"border border-red-500/20 bg-red-500/10 text-red-400",

 // Fallback alias used by existing pages
 unknown:"border border-zinc-700/50 bg-zinc-800/50 text-muted-foreground",
};

const STATUS_BADGE_DEFAULT ="border border-zinc-700/50 bg-zinc-800/50 text-muted-foreground";

/** Status dot colors (solid bg for small indicators). */
export const STATUS_DOT = {
 active:"bg-green-400",
 running:"bg-cyan-400 animate-pulse",
 paused:"bg-yellow-400",
 idle:"bg-yellow-400",
 completed:"bg-blue-400",
 error:"bg-red-400",
 archived:"bg-neutral-400",
 unknown:"bg-muted-foreground",
};

export const STATUS_DOT_DEFAULT ="bg-muted-foreground";

export function StatusBadge({ status, className ="" }) {
 return (
  <span
   className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap shrink-0 ${STATUS_BADGE[status] || STATUS_BADGE_DEFAULT} ${className}`}
  >
   {(status ||"unknown").replace(/_/g,"")}
  </span>
 );
}

export { STATUS_BADGE };
