/**
 * KanbanBoard — status columns with issue cards.
 * Simple click-to-change-status (no drag library needed).
 * Adapted from Paperclip's KanbanBoard layout.
 */
import { useMemo } from"react";
import { IssueCard } from"./IssueCard.jsx";
import { StatusCircle } from"./StatusSelect.jsx";

const BOARD_STATUSES = ["backlog","todo","in_progress","in_review","done"];

function statusLabel(status) {
 return status.replace(/_/g,"").replace(/\b\w/g, (c) => c.toUpperCase());
}

function KanbanColumn({ status, issues, onIssueClick }) {
 return (
  <div className="flex flex-col min-w-[260px] w-[260px] shrink-0">
   <div className="flex items-center gap-2 px-2 py-2 mb-1">
    <StatusCircle status={status} />
    <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
     {statusLabel(status)}
    </span>
    <span className="text-[12px] text-muted-foreground/60 ml-auto tabular-nums">
     {issues.length}
    </span>
   </div>
   <div className="flex-1 min-h-[120px] p-1 space-y-1 bg-muted/20">
    {issues.length === 0 && (
     <div className="flex items-center justify-center py-16 text-[14px] text-muted-foreground">
      No issues
     </div>
    )}
    {issues.map((issue) => (
     <IssueCard
      key={issue.id}
      issue={issue}
      onClick={() => onIssueClick(issue)}
     />
    ))}
   </div>
  </div>
 );
}

export function KanbanBoard({ issues, onIssueClick }) {
 const columnIssues = useMemo(() => {
  const grouped = {};
  for (const status of BOARD_STATUSES) {
   grouped[status] = [];
  }
  for (const issue of issues) {
   const status = issue.status ||"backlog";
   if (grouped[status]) {
    grouped[status].push(issue);
   } else {
    // Put unknown statuses in backlog
    grouped.backlog.push(issue);
   }
  }
  return grouped;
 }, [issues]);

 return (
  <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
   {BOARD_STATUSES.map((status) => (
    <KanbanColumn
     key={status}
     status={status}
     issues={columnIssues[status] || []}
     onIssueClick={onIssueClick}
    />
   ))}
  </div>
 );
}
