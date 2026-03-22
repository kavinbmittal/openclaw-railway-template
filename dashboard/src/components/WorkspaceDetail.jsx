/**
 * WorkspaceDetail — expanded view showing branch, working dir, task description.
 */

import { StatusBadge } from"./StatusBadge.jsx";
import { GitBranch, Folder, FileText, Clock, Cpu } from"lucide-react";

export function WorkspaceDetail({ workspace }) {
 return (
  <div className="px-4 py-3 bg-muted/20 border-t border-border/50 space-y-2">
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
    {workspace.branch && (
     <div className="flex items-center gap-2 text-muted-foreground">
      <GitBranch className="h-3.5 w-3.5 shrink-0" />
      <span className="font-mono">{workspace.branch}</span>
     </div>
    )}
    {workspace.working_dir && (
     <div className="flex items-center gap-2 text-muted-foreground">
      <Folder className="h-3.5 w-3.5 shrink-0" />
      <span className="font-mono truncate">{workspace.working_dir}</span>
     </div>
    )}
    {workspace.model && (
     <div className="flex items-center gap-2 text-muted-foreground">
      <Cpu className="h-3.5 w-3.5 shrink-0" />
      <span className="font-mono">{workspace.model}</span>
     </div>
    )}
    {workspace.duration_ms && (
     <div className="flex items-center gap-2 text-muted-foreground">
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <span>{formatDuration(workspace.duration_ms)}</span>
     </div>
    )}
   </div>
   {workspace.task && (
    <div className="text-[12px] text-muted-foreground mt-2">
     <div className="flex items-center gap-1.5 mb-1">
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="font-medium text-foreground/70">Task</span>
     </div>
     <p className="pl-5 whitespace-pre-wrap break-words leading-relaxed">
      {workspace.task}
     </p>
    </div>
   )}
  </div>
 );
}

function formatDuration(ms) {
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
