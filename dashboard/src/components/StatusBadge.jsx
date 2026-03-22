/**
 * StatusBadge — renders a colored pill for any status string.
 * Color map ported from Paperclip's status-colors.ts (dark-mode only).
 */

const STATUS_BADGE = {
 // Agent / project statuses
 active:"bg-green-900/50 text-green-300",
 running:"bg-cyan-900/50 text-cyan-300",
 paused:"bg-orange-900/50 text-orange-300",
 idle:"bg-yellow-900/50 text-yellow-300",
 archived:"bg-muted text-muted-foreground",

 // Goal / completion
 planned:"bg-muted text-muted-foreground",
 achieved:"bg-green-900/50 text-green-300",
 completed:"bg-blue-900/50 text-blue-300",

 // Run statuses
 failed:"bg-red-900/50 text-red-300",
 timed_out:"bg-orange-900/50 text-orange-300",
 succeeded:"bg-green-900/50 text-green-300",
 error:"bg-red-900/50 text-red-300",
 terminated:"bg-red-900/50 text-red-300",
 pending:"bg-yellow-900/50 text-yellow-300",

 // Approval
 pending_approval:"bg-amber-900/50 text-amber-300",
 revision_requested:"bg-amber-900/50 text-amber-300",
 approved:"bg-green-900/50 text-green-300",
 rejected:"bg-red-900/50 text-red-300",

 // Issue statuses
 proposed:"bg-violet-900/50 text-violet-300",
 backlog:"bg-muted text-muted-foreground",
 todo:"bg-blue-900/50 text-blue-300",
 in_progress:"bg-yellow-900/50 text-yellow-300",
 in_review:"bg-violet-900/50 text-violet-300",
 blocked:"bg-red-900/50 text-red-300",
 done:"bg-green-900/50 text-green-300",
 cancelled:"bg-muted text-muted-foreground",

 // Goal statuses
 not_started:"bg-muted text-muted-foreground",
 at_risk:"bg-red-900/50 text-red-300",

 // Fallback alias used by existing pages
 unknown:"bg-muted text-muted-foreground",
};

const STATUS_BADGE_DEFAULT ="bg-muted text-muted-foreground";

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
   className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${STATUS_BADGE[status] || STATUS_BADGE_DEFAULT} ${className}`}
  >
   {(status ||"unknown").replace(/_/g,"")}
  </span>
 );
}

export { STATUS_BADGE };
