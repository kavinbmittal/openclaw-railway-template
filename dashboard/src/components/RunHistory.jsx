import { CheckCircle2, XCircle, Clock, Loader2 } from"lucide-react";
import { StatusBadge } from"./StatusBadge.jsx";
import { EmptyState } from"./EmptyState.jsx";
import { formatDateTime } from"../utils/formatDate.js";

const STATUS_ICONS = {
 ok: { icon: CheckCircle2, color:"text-green-400" },
 success: { icon: CheckCircle2, color:"text-green-400" },
 succeeded: { icon: CheckCircle2, color:"text-green-400" },
 error: { icon: XCircle, color:"text-red-400" },
 failed: { icon: XCircle, color:"text-red-400" },
 running: { icon: Loader2, color:"text-cyan-400" },
 pending: { icon: Clock, color:"text-yellow-400" },
};

function formatTimestamp(ts) {
 if (!ts) return"--";
 try {
  return formatDateTime(ts);
 } catch {
  return ts;
 }
}

function formatDuration(ms) {
 if (!ms && ms !== 0) return"--";
 const seconds = Math.floor(ms / 1000);
 if (seconds < 60) return `${seconds}s`;
 const minutes = Math.floor(seconds / 60);
 const remaining = seconds % 60;
 return `${minutes}m ${remaining}s`;
}

export function RunHistory({ runs }) {
 if (!runs || runs.length === 0) {
  return (
   <EmptyState
    icon={Clock}
    text="No runs recorded"
    sub="Sub-agent runs will appear here when spawned."
   />
  );
 }

 return (
  <div className="border border-border">
   {/* Header */}
   <div className="grid grid-cols-[1fr_120px_100px_80px_80px] gap-2 px-4 py-2 text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground/60 border-b border-border bg-accent/20">
    <span>Task / Template</span>
    <span>Timestamp</span>
    <span>Model</span>
    <span>Duration</span>
    <span className="text-right">Status</span>
   </div>

   {/* Rows */}
   <div className="divide-y divide-border">
    {runs.map((run, i) => {
     const status = (run.status || run.result ||"unknown").toLowerCase();
     const statusInfo = STATUS_ICONS[status] || STATUS_ICONS.pending;
     const Icon = statusInfo?.icon || Clock;
     const timestamp = run.timestamp || run.started || run.created;
     const duration = run.duration || run.elapsed;
     const model = run.model || run.template ||"--";
     const task = run.task || run.description || run.template || run.id || `Run #${i + 1}`;

     return (
      <div
       key={run.id || i}
       className="grid grid-cols-[1fr_120px_100px_80px_80px] gap-2 px-4 py-2.5 text-[14px] items-center hover:bg-accent/30 transition-colors"
      >
       <div className="flex items-center gap-2 min-w-0">
        <Icon size={14} className={statusInfo?.color ||"text-muted-foreground"} />
        <span className="truncate text-foreground/80">{task}</span>
       </div>
       <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
        {formatTimestamp(timestamp)}
       </span>
       <span className="text-[12px] text-muted-foreground truncate">{model}</span>
       <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
        {formatDuration(duration)}
       </span>
       <span className="flex justify-end">
        <StatusBadge status={status} />
       </span>
      </div>
     );
    })}
   </div>
  </div>
 );
}
