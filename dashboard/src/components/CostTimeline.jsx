/**
 * CostTimeline — chronological list of cost entries.
 * Inspired by Paperclip's FinanceTimelineCard.
 */

import { formatDateTime } from"../utils/formatDate.js";

export function CostTimeline({ entries = [] }) {
 if (entries.length === 0) {
  return (
   <div className="text-center py-8 text-[14px] text-muted-foreground">
    No cost entries yet.
   </div>
  );
 }

 return (
  <div className="border border-border divide-y divide-border">
   {/* Header */}
   <div className="grid grid-cols-[1fr_80px_80px_60px] gap-2 px-4 py-2 text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground/60 font-medium">
    <span>Task</span>
    <span className="text-right">Agent</span>
    <span className="text-right">Cost</span>
    <span className="text-right">Type</span>
   </div>

   {/* Entries */}
   {entries.map((entry, i) => {
    const time = entry.timestamp
     ? formatDateTime(entry.timestamp)
     :"";

    return (
     <div
      key={`${entry.timestamp}-${i}`}
      className="grid grid-cols-[1fr_80px_80px_60px] gap-2 px-4 py-2.5 text-[14px] items-center"
     >
      <div className="min-w-0">
       <p className="text-foreground/80 truncate text-[15px]">{entry.task ||"Untitled"}</p>
       {time && (
        <p className="text-[11px] text-muted-foreground/50 mt-0.5 font-mono tabular-nums">
         {time}
        </p>
       )}
      </div>
      <span className="text-right text-[12px] text-muted-foreground truncate">
       {entry.agent ||"--"}
      </span>
      <span className="text-right font-mono tabular-nums text-[15px]">
       {entry.type ==="claude-code" ? (
        <span className="text-cyan-400">$0.00</span>
       ) : (
        `$${(entry.cost_usd || 0).toFixed(2)}`
       )}
      </span>
      <span className="text-right">
       {entry.type ==="claude-code" ? (
        <span className="text-[11px] uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5">
         CC
        </span>
       ) : (
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/50 px-1.5 py-0.5">
         API
        </span>
       )}
      </span>
     </div>
    );
   })}
  </div>
 );
}
