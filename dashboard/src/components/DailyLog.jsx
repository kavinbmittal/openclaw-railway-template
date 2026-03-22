import { Calendar, Clock } from"lucide-react";
import Markdown from"./Markdown.jsx";
import { EmptyState } from"./EmptyState.jsx";
import { formatDate } from"../utils/formatDate.js";

function formatDateHeader(dateStr) {
 try {
  return formatDate(dateStr +"T00:00:00");
 } catch {
  return dateStr;
 }
}

export function DailyLog({ days, activityEntries }) {
 const hasDays = days && days.length > 0;
 const hasActivity = activityEntries && activityEntries.length > 0;

 if (!hasDays && !hasActivity) {
  return (
   <EmptyState
    icon={Calendar}
    text="No activity logs"
    sub="Daily session transcripts will appear here."
   />
  );
 }

 return (
  <div className="space-y-4">
   {/* Daily logs */}
   {hasDays && days.map((day) => (
    <div key={day.date} className="border border-border">
     <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-accent/20">
      <Calendar size={14} className="text-muted-foreground/60" />
      <span className="text-[11px] uppercase tracking-[0.16em] font-mono font-medium text-muted-foreground">
       {formatDateHeader(day.date)}
      </span>
     </div>
     <div className="p-4 max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-auto-hide">
      <Markdown content={day.content} />
     </div>
    </div>
   ))}

   {/* Activity entries */}
   {hasActivity && (
    <div className="border border-border">
     <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-accent/20">
      <Clock size={14} className="text-muted-foreground/60" />
      <span className="text-[11px] uppercase tracking-[0.16em] font-mono font-medium text-muted-foreground">
       Recent Activity
      </span>
     </div>
     <div className="divide-y divide-border">
      {activityEntries.map((entry, i) => (
       <div key={i} className="px-4 py-3">
        <div className="text-[11px] font-mono text-muted-foreground/50 mb-1">
         {entry.file}
        </div>
        <div className="text-[14px] text-foreground/80 max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-auto-hide">
         <Markdown content={typeof entry.content ==="string" ? entry.content : JSON.stringify(entry.content, null, 2)} />
        </div>
       </div>
      ))}
     </div>
    </div>
   )}
  </div>
 );
}
