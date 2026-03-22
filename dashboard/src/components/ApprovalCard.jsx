/**
 * ApprovalCard — single approval item.
 * UI ported from Aura HTML reference.
 */
import { Clock, CheckCircle2, XCircle, CircleDot, FlaskConical, FileText, Compass } from"lucide-react";
import { formatTimeAgo } from"../utils/formatDate.js";

/* Type badge — Aura bordered pill style */
function TypeBadge({ type }) {
 const badges = {
  "proposed-issue": { label:"Issue", cls:"border-violet-500/20 bg-violet-500/10 text-violet-400" },
  "experiment-start": { label:"Experiment", cls:"border-cyan-500/20 bg-cyan-500/10 text-cyan-400" },
  "autoresearch-start": { label:"Experiment", cls:"border-cyan-500/20 bg-cyan-500/10 text-cyan-400" },
  "proposed-theme": { label:"Theme", cls:"border-teal-500/20 bg-teal-500/10 text-teal-400" },
  theme: { label:"Theme", cls:"border-teal-500/20 bg-teal-500/10 text-teal-400" },
  "deliverable-review": { label:"Deliverable", cls:"border-blue-500/20 bg-blue-500/10 text-blue-400" },
 };

 const badge = badges[type] || (type ? { label: type, cls:"border-amber-500/20 bg-amber-500/10 text-amber-400" } : null);
 if (!badge) return null;

 return (
  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${badge.cls}`}>
   {badge.label}
  </span>
 );
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
 const isRejected = status === "rejected";

 const timeAgo = approval.created
  ? formatTimeAgo(approval.created)
  : approval.timestamp
   ? formatTimeAgo(approval.timestamp)
   :"";

 return (
  <div
   className={`bg-card border border-border rounded-[2px] p-[20px] flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-sm ${
    isRejected ?"opacity-60" :""
   }`}
   onClick={() => {
    if (navigate) navigate("approval-detail", approval.id);
   }}
  >
   {/* Left: type badge + description + metadata */}
   <div className="space-y-2 cursor-pointer">
    <TypeBadge type={itemType} />
    <p className={`text-[15px] font-medium text-foreground ${isRejected ?"line-through decoration-muted-foreground/40" :""}`}>
     {title}
    </p>
    {/* Theme + proxy metrics — matches ProjectApprovalsTab style */}
    {(approval.theme_title || (approval.proxy_metric_names && approval.proxy_metric_names.length > 0)) && (
     <div className="flex flex-wrap items-center gap-2">
      {approval.theme_title && (
       <div className="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-zinc-800/40 border border-zinc-700/30">
        <Compass size={10} className="text-zinc-400" />
        <span className="text-[12px] text-zinc-300">{approval.theme_title}</span>
       </div>
      )}
      {approval.proxy_metric_names && approval.proxy_metric_names.length > 0 && approval.theme_title && (
       <span className="text-zinc-600 text-[14px]">{"\u203A"}</span>
      )}
      {approval.proxy_metric_names && approval.proxy_metric_names.map((pm, i) => (
       <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-zinc-800/40 border border-zinc-700/30">
        <span className="text-[12px] text-zinc-400">{pm}</span>
       </div>
      ))}
     </div>
    )}
    <div className="text-[13px] text-muted-foreground flex items-center gap-2">
     {approval.requester && <span>Requested by: {approval.requester}</span>}
     {approval.requester && timeAgo && <span>·</span>}
     {timeAgo && <span>{timeAgo}</span>}
     {!hideProject && projectName && (
      <>
       <span>·</span>
       <span
        className="hover:text-foreground cursor-pointer"
        onClick={(e) => {
         e.stopPropagation();
         navigate && navigate("project", projectName);
        }}
       >
        {projectName}
       </span>
      </>
     )}
    </div>
    {/* Rejection comment */}
    {isRejected && approval.comment && (
     <div className="text-[15px] text-red-400 flex items-center gap-1.5 mt-2 bg-red-500/10 px-3 py-1.5 rounded-[4px] border border-red-500/20 w-fit">
      <XCircle size={14} />
      Rejected: {approval.comment}
     </div>
    )}
   </div>

   {/* Right: action buttons */}
   {isPending && (
    <div
     className="flex items-center gap-2 shrink-0"
     onClick={(e) => e.stopPropagation()}
    >
     <button
      onClick={() => onReject && onReject(approval)}
      className="px-4 py-1.5 rounded-[6px] border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-[color,box-shadow] text-[15px] font-medium focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-red-500/30"
     >
      Reject
     </button>
     <button
      onClick={() => onApprove && onApprove(approval)}
      className="px-4 py-1.5 rounded-[6px] border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-[color,box-shadow] text-[15px] font-medium focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-emerald-500/30"
     >
      Approve
     </button>
    </div>
   )}
  </div>
 );
}
