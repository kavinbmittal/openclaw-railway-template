/**
 * ActivityRow — single activity log entry.
 * Simplified from Paperclip's ActivityRow (no router, no typed events).
 */

export function ActivityRow({ time, agent, event, className ="" }) {
 return (
  <div className={`flex items-start gap-3 px-4 py-2.5 text-[14px] ${className}`}>
   <span className="shrink-0 text-[12px] text-muted-foreground font-mono tabular-nums pt-0.5 w-28">
    {time}
   </span>
   {agent && (
    <span className="shrink-0">
     <span className="inline-flex items-center px-2 py-0.5 text-[12px] font-medium bg-accent text-accent-foreground">
      {agent}
     </span>
    </span>
   )}
   <span className="text-foreground/80">{event}</span>
  </div>
 );
}
