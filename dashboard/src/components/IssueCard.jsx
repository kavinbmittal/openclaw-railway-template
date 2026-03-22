/**
 * IssueCard — compact card for kanban/list views.
 * Adapted from Paperclip's KanbanCard.
 */
import { PriorityDot } from"./PriorityIcon.jsx";
import { AgentInitial } from"./AssigneeSelect.jsx";

export function IssueCard({ issue, onClick, className ="" }) {
 return (
  <div
   className={`border border-border bg-card p-2.5 cursor-pointer hover:bg-accent/30 transition-colors ${className}`}
   onClick={onClick}
  >
   <div className="flex items-start gap-1.5 mb-1.5">
    <span className="text-[12px] text-muted-foreground font-mono shrink-0">
     {issue.id}
    </span>
   </div>
   <p className="text-[14px] leading-snug line-clamp-2 mb-2">{issue.title}</p>
   <div className="flex items-center gap-2">
    <PriorityDot priority={issue.priority} />
    {issue.assignee && <AgentInitial name={issue.assignee} />}
   </div>
  </div>
 );
}
