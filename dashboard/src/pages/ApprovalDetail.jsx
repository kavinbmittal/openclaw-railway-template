import { useState, useEffect } from"react";
import { Clock, CheckCircle2, XCircle, RotateCcw, Loader2, CircleDot, FlaskConical, FileText, Compass, BarChart3 } from"lucide-react";
import { getApprovalDetail, resolveApproval, requestRevision, updateIssue, deleteIssue, resolveTheme } from"../api.js";
import { formatTimeAgo } from"../utils/formatDate.js";
import Markdown from"../components/Markdown.jsx";
import { StatusBadge } from"../components/StatusBadge.jsx";

function StatusBadgeInline({ status }) {
 if (status ==="approved")
  return (
   <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-900/50 text-green-300">
    <CheckCircle2 size={12} /> Approved
   </span>
  );
 if (status ==="rejected")
  return (
   <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-900/50 text-red-300">
    <XCircle size={12} /> Rejected
   </span>
  );
 if (status ==="revision_requested")
  return (
   <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-900/50 text-amber-300">
    <RotateCcw size={12} /> Revision Requested
   </span>
  );
 return (
  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-900/50 text-amber-300">
   <Clock size={12} /> Pending
  </span>
 );
}

export default function ApprovalDetail({ approvalId, navigate }) {
 const [approval, setApproval] = useState(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [comment, setComment] = useState("");
 const [submitting, setSubmitting] = useState(false);
 const [resolved, setResolved] = useState(null); // { decision, comment }

 useEffect(() => {
  setLoading(true);
  setError(null);
  getApprovalDetail(approvalId)
   .then(setApproval)
   .catch((e) => setError(e.message))
   .finally(() => setLoading(false));
 }, [approvalId]);

 const isProposedIssue = approval?._source ==="issue";

 const isThemeProposal = approval?._source === "theme";

 async function handleResolve(decision) {
  if (!isProposedIssue && !isThemeProposal && (decision ==="rejected" || decision ==="revision_requested") && !comment.trim()) {
   setError(decision ==="revision_requested"
    ?"Feedback is required when requesting a revision."
    :"A note is required when rejecting.");
   return;
  }

  setSubmitting(true);
  setError(null);

  try {
   const projectName = approval._project || approval.project;

   if (isThemeProposal) {
    // Theme proposals: approve/reject/revise via resolveTheme
    await resolveTheme(projectName, approval.id, decision, comment.trim() || null);
   } else if (isProposedIssue) {
    // Proposed issues: approve → move to todo, reject → delete
    if (decision ==="approved") {
     await updateIssue(approval.id, projectName, { status:"todo" });
    } else {
     await deleteIssue(approval.id, projectName);
    }
   } else if (decision ==="revision_requested") {
    await requestRevision({
     project: projectName,
     id: approval.id,
     feedback: comment.trim(),
     requester: approval.requester,
     gate: approval.gate,
     what: approval.what || approval.title,
     why: approval.why,
     created: approval.created,
    });
   } else {
    await resolveApproval({
     project: projectName,
     id: approval.id,
     decision,
     comment: comment.trim() || null,
     requester: approval.requester,
     gate: approval.gate,
     what: approval.what || approval.title,
     why: approval.why,
     created: approval.created,
    });
   }
   setResolved({ decision, comment: comment.trim() || null });
   // Refresh approval data (skip for deleted items)
   if (!(isProposedIssue && decision ==="rejected") && !(isThemeProposal && decision ==="rejected")) {
    const updated = await getApprovalDetail(approvalId).catch(() => null);
    if (updated) setApproval(updated);
   }
  } catch (err) {
   setError(err.message);
  } finally {
   setSubmitting(false);
  }
 }

 if (loading) {
  return (
   <div className="max-w-3xl mx-auto space-y-4 p-4">
    <div className="bg-accent/75 h-6 w-48 rounded" />
    <div className="bg-accent/75 h-4 w-32 rounded" />
    <div className="bg-accent/75 h-32 w-full rounded" />
   </div>
  );
 }

 if (!approval) {
  return (
   <div className="max-w-3xl mx-auto p-4">
    <p className="text-sm text-muted-foreground">
     {error ||"Approval not found."}
    </p>
   </div>
  );
 }

 const projectName = approval._project || approval.project;
 const title = approval.what || approval.title ||"";
 const status = resolved ? resolved.decision : (approval.status ||"pending");
 const isPending = status ==="pending" || status === "proposed";
 const isRevisionRequested = status ==="revision_requested";
 const isDeliverable =
  approval._source ==="deliverables" ||
  approval.gate ==="deliverable" ||
  approval.gate ==="deliverable-review";
 const isExperiment = approval.gate ==="experiment-start" || approval.gate ==="autoresearch-start";
 const isIssue = approval._source ==="issue";
 const isTheme = approval._source ==="theme";

 const timeAgo = approval.created
  ? formatTimeAgo(approval.created)
  : approval.timestamp
   ? formatTimeAgo(approval.timestamp)
   :"";

 return (
  <div className="max-w-3xl mx-auto space-y-6">
   {/* Breadcrumb */}
   <div className="h-12 flex items-center gap-2">
    <button
     onClick={() => navigate("overview")}
     className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
    >
     Overview
    </button>
    <span className="text-muted-foreground/40">›</span>
    <button
     onClick={() => navigate("approvals")}
     className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
    >
     Approvals
    </button>
    <span className="text-muted-foreground/40">›</span>
    <span className="text-[13px] font-semibold text-foreground truncate">
     {title}
    </span>
   </div>

   {/* Success banner after resolution */}
   {resolved && (
    <div
     className={`border px-4 py-3 ${
      resolved.decision ==="approved"
       ?"border-green-700/40 bg-green-900/20"
       : resolved.decision ==="revision_requested"
        ?"border-amber-700/40 bg-amber-900/20"
        :"border-red-700/40 bg-red-900/20"
     }`}
    >
     <div className="flex items-center gap-2">
      {resolved.decision ==="approved" ? (
       <CheckCircle2 size={16} className="text-green-300" />
      ) : resolved.decision ==="revision_requested" ? (
       <RotateCcw size={16} className="text-amber-300" />
      ) : (
       <XCircle size={16} className="text-red-300" />
      )}
      <p
       className={`text-sm font-medium ${
        resolved.decision ==="approved"
         ?"text-green-100"
         : resolved.decision ==="revision_requested"
          ?"text-amber-100"
          :"text-red-100"
       }`}
      >
       {resolved.decision ==="approved"
        ? (isThemeProposal ? "Theme approved" : isIssue ?"Issue approved — moved to todo" :"Approved")
        : resolved.decision ==="revision_requested"
         ?"Revision Requested"
         : (isThemeProposal ? "Theme rejected — removed" : isIssue ?"Issue rejected — removed" :"Rejected")}
       {resolved.comment && (
        <span className="font-normal text-xs ml-2 opacity-80">
         — {resolved.comment}
        </span>
       )}
      </p>
     </div>
    </div>
   )}

   {/* Header card */}
   <div className="bg-card rounded-sm border border-border shadow-sm p-6 space-y-4">
    {/* Type + Status + Title */}
    <div className="flex items-start justify-between gap-3">
     <div className="flex items-center gap-2 flex-wrap">
      {isTheme ? (
       <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-teal-900/50 text-teal-300">
        <Compass size={12} /> Theme
       </span>
      ) : isIssue ? (
       <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-violet-900/50 text-violet-300">
        <CircleDot size={12} /> Issue
       </span>
      ) : isExperiment ? (
       <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-amber-900/50 text-amber-300">
        <FlaskConical size={12} /> Experiment
       </span>
      ) : isDeliverable ? (
       <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-blue-900/50 text-blue-300">
        <FileText size={12} /> Deliverable
       </span>
      ) : approval.gate ? (
       <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-amber-900/50 text-amber-300">
        {approval.gate}
       </span>
      ) : null}
      <StatusBadgeInline status={status} />
     </div>
    </div>
    <h1 className="text-lg font-semibold text-foreground">{title}</h1>

    {/* Metadata */}
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
     {projectName && (
      <span>
       Project:{""}
       <button
        onClick={() => navigate("project", projectName)}
        className="text-primary hover:underline"
       >
        {projectName}
       </button>
      </span>
     )}
     {approval.requester && (
      <span>
       Requested by{""}
       <button
        className="hover:underline hover:text-foreground transition-colors"
        onClick={() => {
         const name = (approval.requester ||"").toLowerCase();
         const workspaceId =
          name ==="sam" ?"workspace" : `workspace-${name}`;
         navigate("agent-detail", workspaceId);
        }}
       >
        {approval.requester}
       </button>
      </span>
     )}
     {timeAgo && <span>{timeAgo}</span>}
     {isIssue && approval.priority && approval.priority !=="none" && (
      <span className="uppercase">{approval.priority} priority</span>
     )}
    </div>
    {isIssue && approval.labels && approval.labels.length > 0 && (
     <div className="flex flex-wrap gap-1.5 mt-2">
      {approval.labels.map((label) => (
       <span key={label} className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-accent text-accent-foreground">
        {label}
       </span>
      ))}
     </div>
    )}
   </div>

   {/* Theme proposal — structured proxy metrics display */}
   {isTheme && (
    <div className="border border-border p-6 space-y-4">
     {approval.description && (
      <div>
       <h3 className="text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground mb-2">
        Description
       </h3>
       <p className="text-sm text-foreground/80">{approval.description}</p>
      </div>
     )}
     {approval.proxy_metrics && approval.proxy_metrics.length > 0 && (
      <div>
       <h3 className="text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground mb-3">
        Proxy Metrics
       </h3>
       <div className="space-y-3">
        {approval.proxy_metrics.map((pm, i) => (
         <div key={pm.id || i} className="flex items-start gap-3 p-3 border border-border/60 bg-accent/10">
          <BarChart3 size={14} className="text-teal-400 mt-0.5 shrink-0" />
          <div>
           <p className="text-sm font-medium text-foreground">{pm.name}</p>
           {pm.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{pm.description}</p>
           )}
          </div>
         </div>
        ))}
       </div>
      </div>
     )}
    </div>
   )}

   {/* Theme tag on issue/experiment — shows which theme this work targets */}
   {!isTheme && approval.theme_title && (
    <div className="border border-teal-700/30 bg-teal-900/10 px-4 py-3">
     <div className="flex items-center gap-2">
      <Compass size={14} className="text-teal-400" />
      <span className="text-xs text-teal-300 font-medium">Theme: {approval.theme_title}</span>
      {approval.proxy_metric_names && approval.proxy_metric_names.length > 0 && (
       <span className="text-xs text-muted-foreground">
        — targeting: {approval.proxy_metric_names.join(", ")}
       </span>
      )}
     </div>
    </div>
   )}

   {/* Proposed issue description */}
   {isIssue && approval.why && (
    <div className="bg-card rounded-sm border border-border shadow-sm p-6">
     <h3 className="text-sm font-semibold text-muted-foreground mb-3">
      Proposed Issue
     </h3>
     <div className="mc-prose">
      <Markdown content={approval.why} className="text-sm" />
     </div>
    </div>
   )}

   {/* Why / Body — for experiments, this is the agent's case */}
   {approval.why && !isDeliverable && (
    <div className="bg-card rounded-sm border border-border shadow-sm p-6">
     <h3 className="text-sm font-semibold text-muted-foreground mb-3">
      {isExperiment ?"Approval Request" :"Details"}
     </h3>
     <div className="mc-prose">
      <Markdown content={approval.why} className="text-sm" />
     </div>
    </div>
   )}

   {/* Experiment Plan — rendered from program.md (single source of truth) */}
   {isExperiment && approval.programMd && (
    <div className="bg-card rounded-sm border border-border shadow-sm p-6">
     <h3 className="text-sm font-semibold text-muted-foreground mb-3">
      Experiment Plan
     </h3>
     <div className="border border-border/60 rounded p-4 bg-background max-h-[calc(100vh-400px)] overflow-y-auto mc-prose">
      <Markdown content={approval.programMd} className="text-sm" />
     </div>
    </div>
   )}

   {/* Deliverable content */}
   {isDeliverable && approval.why && (
    <div className="bg-card rounded-sm border border-border shadow-sm p-6">
     <h3 className="text-sm font-semibold text-muted-foreground mb-3">
      Deliverable
     </h3>
     <div className="border border-border/60 rounded p-4 bg-background max-h-[calc(100vh-400px)] overflow-y-auto mc-prose">
      <Markdown content={approval.why} className="text-sm" />
     </div>
    </div>
   )}

   {/* Decision note / Actions */}
   {isPending && !resolved && (
    <div className="bg-card rounded-sm border border-border shadow-sm p-6 space-y-4">
     <h3 className="text-sm font-semibold text-muted-foreground">
      Decision
     </h3>
     {!isIssue && (
      <textarea
       value={comment}
       onChange={(e) => setComment(e.target.value)}
       placeholder={isThemeProposal ? "Feedback (optional)" : "Decision note (required for rejections and revisions)"}
       rows={3}
       className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors resize-none"
      />
     )}

     {error && <p className="text-xs text-red-400">{error}</p>}

     <div className="flex items-center gap-2">
      <button
       onClick={() => handleResolve("approved")}
       disabled={submitting}
       className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
      >
       {submitting ? (
        <Loader2 size={14} className="animate-spin" />
       ) : (
        <CheckCircle2 size={14} />
       )}
       {isThemeProposal ? "Approve Theme" : isIssue ?"Approve Issue" :"Approve"}
      </button>
      {(!isIssue) && (
       <button
        onClick={() => handleResolve("revision_requested")}
        disabled={submitting || !comment.trim()}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
       >
        {submitting ? (
         <Loader2 size={14} className="animate-spin" />
        ) : (
         <RotateCcw size={14} />
        )}
        Request Revision
       </button>
      )}
      <button
       onClick={() => handleResolve("rejected")}
       disabled={submitting || (!isIssue && !isThemeProposal && !comment.trim())}
       className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
      >
       {submitting ? (
        <Loader2 size={14} className="animate-spin" />
       ) : (
        <XCircle size={14} />
       )}
       {isThemeProposal ? "Reject Theme" : isIssue ?"Reject Issue" :"Reject"}
      </button>
     </div>
    </div>
   )}

   {/* Already resolved info */}
   {!isPending && !isRevisionRequested && !resolved && (
    <div className="bg-card rounded-sm border border-border shadow-sm p-6">
     <div className="flex items-center gap-2">
      {status ==="approved" ? (
       <CheckCircle2 size={16} className="text-green-400" />
      ) : (
       <XCircle size={16} className="text-red-400" />
      )}
      <span className="text-sm font-medium capitalize">{status}</span>
      {approval.resolved_at && (
       <span className="text-xs text-muted-foreground ml-2">
        {formatTimeAgo(approval.resolved_at)}
       </span>
      )}
     </div>
     {approval.comment && (
      <p className="text-sm text-muted-foreground mt-2">
       Note: {approval.comment}
      </p>
     )}
    </div>
   )}

   {/* Revision requested — waiting on agent */}
   {isRevisionRequested && !resolved && (
    <div className="border border-amber-700/40 p-6 bg-amber-900/10">
     <div className="flex items-center gap-2">
      <RotateCcw size={16} className="text-amber-400" />
      <span className="text-sm font-medium text-amber-200">Revision Requested</span>
      {approval.revision_requested_at && (
       <span className="text-xs text-muted-foreground ml-2">
        {formatTimeAgo(approval.revision_requested_at)}
       </span>
      )}
     </div>
     {approval.revision_feedback && (
      <p className="text-sm text-muted-foreground mt-2">
       Feedback: {approval.revision_feedback}
      </p>
     )}
     <p className="text-xs text-muted-foreground mt-3">
      Waiting for {approval.requester ||"agent"} to resubmit.
     </p>
    </div>
   )}
  </div>
 );
}
