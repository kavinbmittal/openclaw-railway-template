import { Check, X, Clock, CheckCircle2, XCircle, CircleDot, FlaskConical, FileText, Compass } from"lucide-react";
import { formatTimeAgo } from"../utils/formatDate.js";

function statusIcon(status) {
 if (status ==="approved")
  return <CheckCircle2 size={14} className="text-green-400" />;
 if (status ==="rejected")
  return <XCircle size={14} className="text-red-400" />;
 // pending or anything else
 return <Clock size={14} className="text-amber-400" />;
}

// Type badge — distinguishes proposed issues from gate requests
function TypeBadge({ type }) {
 if (type ==="proposed-issue") {
  return (
   <span className="shrink-0 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-violet-900/50 text-violet-300">
    <CircleDot size={10} />
    Issue
   </span>
  );
 }
 if (type ==="experiment-start" || type ==="autoresearch-start") {
  return (
   <span className="shrink-0 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-amber-900/50 text-amber-300">
    <FlaskConical size={10} />
    Experiment
   </span>
  );
 }
 if (type ==="proposed-theme" || type ==="theme") {
  return (
   <span className="shrink-0 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-teal-900/50 text-teal-300">
    <Compass size={10} />
    Theme
   </span>
  );
 }
 if (type ==="deliverable-review") {
  return (
   <span className="shrink-0 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-blue-900/50 text-blue-300">
    <FileText size={10} />
    Deliverable
   </span>
  );
 }
 // Fallback: show the gate name if present
 if (type) {
  return (
   <span className="shrink-0 inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-amber-900/50 text-amber-300">
    {type}
   </span>
  );
 }
 return null;
}

export default function ApprovalCard({
 approval,
 onApprove,
 onReject,
 navigate,
 hideProject = false,
}) {
 const projectName = approval._project || approval.project;
 const title = approval.what || approval.title ||"";
 const isPending =
  !approval.status || approval.status ==="pending" || approval.status === "proposed" || approval.status === undefined;
 const status = approval.status ||"pending";
 const itemType = approval.type || approval.gate || null;

 const timeAgo = approval.created
  ? formatTimeAgo(approval.created)
  : approval.timestamp
   ? formatTimeAgo(approval.timestamp)
   :"";

 return (
  <div
   className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
   onClick={() => {
    if (navigate) navigate("approval-detail", approval.id);
   }}
  >
   {/* Status icon */}
   <div className="shrink-0">{statusIcon(status)}</div>

   {/* Type badge + title + project */}
   <div className="flex items-center gap-2 flex-1 min-w-0">
    <TypeBadge type={itemType} />
    <span className="text-sm font-medium text-foreground truncate">
     {title}
    </span>
    {/* Theme tag — shows which theme this work is tagged to */}
    {approval.theme_title && (
     <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-teal-900/40 text-teal-300">
      <Compass size={9} />
      {approval.theme_title}
     </span>
    )}
    {!hideProject && projectName && (
     <span
      className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-accent text-accent-foreground cursor-pointer hover:underline"
      onClick={(e) => {
       e.stopPropagation();
       navigate && navigate("project", projectName);
      }}
     >
      {projectName}
     </span>
    )}
   </div>

   {/* Right side: priority (issues only), requester, time, buttons */}
   <div className="flex items-center gap-3 shrink-0">
    {approval.priority && approval.priority !=="none" && (
     <span className="text-[11px] text-muted-foreground/60 uppercase hidden sm:inline">
      {approval.priority}
     </span>
    )}
    {approval.requester && (
     <span className="text-xs text-muted-foreground hidden sm:inline">
      {approval.requester}
     </span>
    )}
    {timeAgo && (
     <span className="text-xs text-muted-foreground/60 hidden sm:inline">
      {timeAgo}
     </span>
    )}
    {isPending && (
     <div
      className="flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
     >
      <button
       onClick={() => onApprove && onApprove(approval)}
       className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
      >
       <Check size={12} />
       Approve
      </button>
      <button
       onClick={() => onReject && onReject(approval)}
       className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
      >
       <X size={12} />
       Reject
      </button>
     </div>
    )}
    {!isPending && (
     <span className="text-xs text-muted-foreground capitalize">{status}</span>
    )}
   </div>
  </div>
 );
}
