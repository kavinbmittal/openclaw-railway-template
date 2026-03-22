/**
 * WorkspaceRow — table row for an execution workspace with expandable detail.
 */

import { useState } from"react";
import { ChevronRight } from"lucide-react";
import { StatusBadge } from"./StatusBadge.jsx";
import { WorkspaceDetail } from"./WorkspaceDetail.jsx";
import { formatTimeAgo } from"../utils/formatDate.js";

function timeAgo(iso) {
 if (!iso) return"";
 return formatTimeAgo(iso);
}

function formatDuration(ms) {
 if (!ms) return"--";
 if (ms < 1000) return `${ms}ms`;
 const s = Math.floor(ms / 1000);
 if (s < 60) return `${s}s`;
 const m = Math.floor(s / 60);
 const rs = s % 60;
 if (m < 60) return `${m}m ${rs}s`;
 const h = Math.floor(m / 60);
 const rm = m % 60;
 return `${h}h ${rm}m`;
}

const TYPE_BADGE = {
"claude-code":"bg-violet-900/40 text-violet-300",
"openclaw":"bg-blue-900/40 text-blue-300",
"coding-agent":"bg-violet-900/40 text-violet-300",
};

export function WorkspaceRow({ workspace }) {
 const [expanded, setExpanded] = useState(false);

 return (
  <div className="border-b border-border last:border-b-0">
   <div
    className="flex items-center gap-3 px-4 py-2.5 text-[14px] cursor-pointer hover:bg-accent/30 transition-colors"
    onClick={() => setExpanded(!expanded)}
   >
    {/* Expand chevron */}
    <ChevronRight
     className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${expanded ?"rotate-90" :""}`}
    />

    {/* Agent */}
    <span className="w-20 shrink-0 truncate capitalize font-medium">
     {workspace.agent}
    </span>

    {/* Project */}
    <span className="w-28 shrink-0 truncate text-muted-foreground font-mono text-[12px]">
     {workspace.project ||"--"}
    </span>

    {/* Issue */}
    <span className="w-16 shrink-0 truncate text-muted-foreground font-mono text-[12px]">
     {workspace.issue ||"--"}
    </span>

    {/* Type */}
    <span
     className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap shrink-0 ${
      TYPE_BADGE[workspace.type] ||"bg-muted text-muted-foreground"
     }`}
    >
     {workspace.type ||"unknown"}
    </span>

    {/* Model */}
    <span className="w-20 shrink-0 truncate text-muted-foreground font-mono text-[11px] hidden lg:block">
     {workspace.model ||"--"}
    </span>

    {/* Status */}
    <StatusBadge status={workspace.status} />

    {/* Duration */}
    <span className="w-16 shrink-0 text-right text-[12px] text-muted-foreground tabular-nums hidden sm:block">
     {formatDuration(workspace.duration_ms)}
    </span>

    {/* Started */}
    <span className="w-16 shrink-0 text-right text-[12px] text-muted-foreground tabular-nums hidden md:block">
     {timeAgo(workspace.started)}
    </span>
   </div>

   {/* Expanded detail */}
   {expanded && <WorkspaceDetail workspace={workspace} />}
  </div>
 );
}
