/**
 * ApprovalDetail — single approval view with two-panel layout.
 * UI ported from Aura HTML reference.
 */
import { useState, useEffect } from"react";
import { CheckCircle2, XCircle, RotateCcw, Loader2, CircleDot, FlaskConical, FileText, Compass, BarChart3, Clock } from"lucide-react";
import { getApprovalDetail, resolveApproval, requestRevision, updateIssue, deleteIssue, resolveTheme } from"../api.js";
import { formatTimeAgo } from"../utils/formatDate.js";
import Markdown from"../components/Markdown.jsx";
import { StatusBadge } from"../components/StatusBadge.jsx";

/* Status badge — Aura bordered pill */
function StatusBadgeInline({ status }) {
 const map = {
  approved: { label:"Approved", cls:"border-emerald-500/30 bg-emerald-500/10 text-emerald-400", dot:"bg-emerald-400" },
  rejected: { label:"Rejected", cls:"border-red-500/30 bg-red-500/10 text-red-400", dot:"bg-red-400" },
  revision_requested: { label:"Revision Requested", cls:"border-amber-500/30 bg-amber-500/10 text-amber-400", dot:"bg-amber-400 animate-pulse" },
 };
 const def = { label:"Pending Review", cls:"border-amber-500/30 bg-amber-500/10 text-amber-400", dot:"bg-amber-400 animate-pulse" };
 const badge = map[status] || def;

 return (
  <span className={`px-3 py-1 rounded-full text-[12px] font-medium border flex items-center gap-1.5 ${badge.cls}`}>
   <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
   {badge.label}
  </span>
 );
}

/* Type label — mono code style like Aura */
function TypeLabel({ type }) {
 if (!type) return null;
 return (
  <span className="px-1.5 py-0.5 rounded-[2px] border border-border bg-secondary text-foreground/80 text-[11px] font-mono tracking-wide leading-tight">
   {type.toUpperCase().replace(/-/g,"_")}
  </span>
 );
}

export default function ApprovalDetail({ approvalId, navigate }) {
 const [approval, setApproval] = useState(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [comment, setComment] = useState("");
 const [submitting, setSubmitting] = useState(false);
 const [resolved, setResolved] = useState(null);

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
    await resolveTheme(projectName, approval.id, decision, comment.trim() || null);
   } else if (isProposedIssue) {
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
   <div className="max-w-[1200px] mx-auto space-y-4">
    <div className="bg-accent/50 h-4 w-48 rounded-[2px]" />
    <div className="bg-accent/50 h-8 w-96 rounded-[2px]" />
    <div className="bg-accent/50 h-4 w-64 rounded-[2px]" />
    <div className="bg-accent/50 h-64 w-full rounded-[2px] mt-4" />
   </div>
  );
 }

 if (!approval) {
  return (
   <div className="max-w-[1200px] mx-auto">
    <p className="text-[14px] text-muted-foreground">{error ||"Approval not found."}</p>
   </div>
  );
 }

 const projectName = approval._project || approval.project;
 const title = approval.what || approval.title ||"";
 const status = resolved ? resolved.decision : (approval.status ||"pending");
 const isPending = status ==="pending" || status === "proposed";
 const isRevisionRequested = status ==="revision_requested";
 const isDeliverable = approval._source ==="deliverables" || approval.gate ==="deliverable" || approval.gate ==="deliverable-review";
 const isExperiment = approval.gate ==="experiment-start" || approval.gate ==="autoresearch-start";
 const isIssue = approval._source ==="issue";
 const isTheme = approval._source ==="theme";
 const itemType = approval.type || approval.gate || null;

 const timeAgo = approval.created
  ? formatTimeAgo(approval.created)
  : approval.timestamp
   ? formatTimeAgo(approval.timestamp)
   :"";

 return (
  <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
   {/* Page Header — Aura: px-8 py-8 border-b, sticky */}
   <header className="px-0 pb-8 border-b border-border shrink-0">
    {/* Breadcrumb */}
    <nav className="flex items-center text-[13px] text-muted-foreground mb-5 tracking-wide">
     <button onClick={() => navigate("approvals")} className="hover:text-foreground transition-colors">Approvals</button>
     {projectName && (
      <>
       <span className="mx-2 text-muted-foreground/30">›</span>
       <button onClick={() => navigate("project", projectName)} className="hover:text-foreground transition-colors capitalize">{projectName}</button>
      </>
     )}
     <span className="mx-2 text-muted-foreground/30">›</span>
     <span className="text-foreground font-semibold truncate">{title}</span>
    </nav>

    {/* Title + Status Badge — Aura: text-[30px] + bordered pill */}
    <div className="flex items-center gap-4 mb-4">
     <h1 className="text-[30px] font-semibold text-foreground leading-none tracking-tight">{title}</h1>
     <StatusBadgeInline status={status} />
    </div>

    {/* Metadata — Aura: text-[13px] with type label + dot separators */}
    <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
     <TypeLabel type={itemType} />
     {approval.requester && (
      <>
       <span className="text-muted-foreground/30">·</span>
       <span>Requested by{" "}
        <button
         className="text-foreground font-medium hover:underline capitalize"
         onClick={() => {
          const name = (approval.requester ||"").toLowerCase();
          const workspaceId = name ==="sam" ?"workspace" : `workspace-${name}`;
          navigate("agent-detail", workspaceId);
         }}
        >
         {approval.requester}
        </button>
       </span>
      </>
     )}
     {timeAgo && (
      <>
       <span className="text-muted-foreground/30">·</span>
       <span>{timeAgo}</span>
      </>
     )}
    </div>
   </header>

   {/* Scrollable Content — Aura: grid-cols-3 */}
   <div className="flex-1 overflow-y-auto pt-6">
    <div className="max-w-[1200px] grid grid-cols-1 xl:grid-cols-3 gap-6">

     {/* Left Column — 2/3 */}
     <div className="xl:col-span-2 space-y-6">

      {/* Success/rejection banner */}
      {resolved && (
       <div className={`border rounded-[2px] px-5 py-3 ${
        resolved.decision ==="approved"
         ?"border-emerald-500/20 bg-emerald-500/5"
         : resolved.decision ==="revision_requested"
          ?"border-amber-500/20 bg-amber-500/5"
          :"border-red-500/20 bg-red-500/5"
       }`}>
        <div className="flex items-center gap-2">
         {resolved.decision ==="approved" ? <CheckCircle2 size={16} className="text-emerald-400" /> :
          resolved.decision ==="revision_requested" ? <RotateCcw size={16} className="text-amber-400" /> :
          <XCircle size={16} className="text-red-400" />}
         <span className="text-[14px] font-medium text-foreground">
          {resolved.decision ==="approved"
           ? (isThemeProposal ? "Theme approved" : isIssue ?"Issue approved — moved to todo" :"Approved")
           : resolved.decision ==="revision_requested" ?"Revision Requested"
           : (isThemeProposal ? "Theme rejected" : isIssue ?"Issue rejected — removed" :"Rejected")}
         </span>
         {resolved.comment && (
          <span className="text-[13px] text-muted-foreground ml-2">— {resolved.comment}</span>
         )}
        </div>
       </div>
      )}

      {/* Details Card — Aura card */}
      {approval.why && (
       <section className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
        <header className="p-[20px] border-b border-border">
         <h2 className="text-[14px] font-semibold text-foreground">
          {isExperiment ?"Approval Request" : isDeliverable ?"Deliverable" : isIssue ?"Proposed Issue" :"Details"}
         </h2>
        </header>
        <div className="p-[20px] text-[14px] text-foreground/80 leading-relaxed mc-prose">
         <Markdown content={approval.why} />
        </div>
       </section>
      )}

      {/* Theme proposal — proxy metrics */}
      {isTheme && (
       <section className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
        <header className="p-[20px] border-b border-border">
         <h2 className="text-[14px] font-semibold text-foreground">Theme Details</h2>
        </header>
        <div className="p-[20px] space-y-5">
         {approval.description && (
          <p className="text-[14px] text-foreground/80">{approval.description}</p>
         )}
         {approval.proxy_metrics && approval.proxy_metrics.length > 0 && (
          <div>
           <h3 className="text-[11px] uppercase tracking-[0.15em] font-mono text-muted-foreground mb-3">
            Proxy Metrics
           </h3>
           <div className="space-y-3">
            {approval.proxy_metrics.map((pm, i) => (
             <div key={pm.id || i} className="flex items-start gap-3 p-3 border border-border/60 bg-accent/10 rounded-[2px]">
              <BarChart3 size={14} className="text-teal-400 mt-0.5 shrink-0" />
              <div>
               <p className="text-[14px] font-medium text-foreground">{pm.name}</p>
               {pm.description && <p className="text-[13px] text-muted-foreground mt-0.5">{pm.description}</p>}
              </div>
             </div>
            ))}
           </div>
          </div>
         )}
        </div>
       </section>
      )}

      {/* Experiment Plan */}
      {isExperiment && approval.programMd && (
       <section className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
        <header className="p-[20px] border-b border-border">
         <h2 className="text-[14px] font-semibold text-foreground">Experiment Plan</h2>
        </header>
        <div className="p-[20px] mc-prose">
         <Markdown content={approval.programMd} />
        </div>
       </section>
      )}

      {/* Theme tag on non-theme items */}
      {!isTheme && approval.theme_title && (
       <div className="border border-teal-500/20 bg-teal-500/5 rounded-[2px] px-5 py-3">
        <div className="flex items-center gap-2">
         <Compass size={14} className="text-teal-400" />
         <span className="text-[13px] text-teal-400 font-medium">Theme: {approval.theme_title}</span>
         {approval.proxy_metric_names && approval.proxy_metric_names.length > 0 && (
          <span className="text-[13px] text-muted-foreground">— targeting: {approval.proxy_metric_names.join(", ")}</span>
         )}
        </div>
       </div>
      )}

      {/* Already resolved info */}
      {!isPending && !isRevisionRequested && !resolved && (
       <div className="bg-card border border-border rounded-[2px] shadow-sm p-[20px]">
        <div className="flex items-center gap-2">
         {status ==="approved" ? <CheckCircle2 size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-red-400" />}
         <span className="text-[14px] font-medium capitalize">{status}</span>
         {approval.resolved_at && <span className="text-[13px] text-muted-foreground ml-2">{formatTimeAgo(approval.resolved_at)}</span>}
        </div>
        {approval.comment && <p className="text-[14px] text-muted-foreground mt-2">Note: {approval.comment}</p>}
       </div>
      )}

      {/* Revision requested */}
      {isRevisionRequested && !resolved && (
       <div className="border border-amber-500/20 bg-amber-500/5 rounded-[2px] p-[20px]">
        <div className="flex items-center gap-2">
         <RotateCcw size={16} className="text-amber-400" />
         <span className="text-[14px] font-medium text-amber-300">Revision Requested</span>
         {approval.revision_requested_at && <span className="text-[13px] text-muted-foreground ml-2">{formatTimeAgo(approval.revision_requested_at)}</span>}
        </div>
        {approval.revision_feedback && <p className="text-[14px] text-muted-foreground mt-2">Feedback: {approval.revision_feedback}</p>}
        <p className="text-[13px] text-muted-foreground mt-3">Waiting for {approval.requester ||"agent"} to resubmit.</p>
       </div>
      )}
     </div>

     {/* Right Column — 1/3 */}
     <div className="xl:col-span-1 space-y-6">

      {/* Actions Card — Aura: sticky, approve/reject buttons */}
      {isPending && !resolved && (
       <section className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col sticky top-0">
        <header className="p-[20px] border-b border-border">
         <h2 className="text-[14px] font-semibold text-foreground">Actions</h2>
        </header>
        <div className="p-[20px] space-y-3">
         <button
          onClick={() => handleResolve("approved")}
          disabled={submitting}
          className="w-full py-2.5 rounded-[6px] border border-emerald-500/30 bg-emerald-500/10 text-[14px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all flex justify-center items-center gap-2 focus:ring-2 focus:ring-emerald-500/50 outline-none disabled:opacity-50"
         >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          {isThemeProposal ? "Approve Theme" : isIssue ?"Approve Issue" :"Approve Request"}
         </button>

         {!isIssue && (
          <button
           onClick={() => handleResolve("revision_requested")}
           disabled={submitting || !comment.trim()}
           className="w-full py-2.5 rounded-[6px] border border-amber-500/30 bg-amber-500/10 text-[14px] font-medium text-amber-400 hover:bg-amber-500/20 transition-all flex justify-center items-center gap-2 focus:ring-2 focus:ring-amber-500/50 outline-none disabled:opacity-50"
          >
           {submitting ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
           Request Revision
          </button>
         )}

         <button
          onClick={() => handleResolve("rejected")}
          disabled={submitting || (!isIssue && !isThemeProposal && !comment.trim())}
          className="w-full py-2.5 rounded-[6px] border border-red-500/30 bg-red-500/10 text-[14px] font-medium text-red-400 hover:bg-red-500/20 transition-all flex justify-center items-center gap-2 focus:ring-2 focus:ring-red-500/50 outline-none disabled:opacity-50"
         >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
          {isThemeProposal ? "Reject Theme" : isIssue ?"Reject Issue" :"Reject Request"}
         </button>

         {/* Comment textarea — Aura style */}
         {!isIssue && (
          <div className="pt-4 mt-2 border-t border-border/60 flex flex-col gap-3">
           <label className="text-[12px] font-medium text-muted-foreground flex items-center justify-between">
            {isThemeProposal ?"Feedback" :"Rejection Comment"}
            <span className="text-muted-foreground/50 font-normal text-[11px]">{isIssue ?"" : isThemeProposal ?"Optional" :"Required"}</span>
           </label>
           <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-[6px] border border-border bg-background text-[14px] text-foreground p-3 placeholder:text-muted-foreground/40 focus:outline-none focus:border-ring/50 focus:ring-1 focus:ring-ring/50 transition-all resize-none h-20"
            placeholder="Provide context..."
           />
          </div>
         )}

         {error && <p className="text-[13px] text-red-400 mt-2">{error}</p>}
        </div>
       </section>
      )}

      {/* Info Card — Aura: p-[20px] space-y-5 with mono labels */}
      <section className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
       <div className="p-[20px] space-y-5">
        <div>
         <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-1.5">Type</div>
         <div className="text-[14px] text-foreground capitalize">{itemType ? itemType.replace(/-/g," ") :"Approval"}</div>
        </div>
        {projectName && (
         <div>
          <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-1.5">Project</div>
          <button
           onClick={() => navigate("project", projectName)}
           className="text-[14px] text-foreground hover:underline capitalize"
          >
           {projectName}
          </button>
         </div>
        )}
        {approval.requester && (
         <div>
          <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-1.5">Requested By</div>
          <div className="text-[14px] text-foreground capitalize">{approval.requester}</div>
         </div>
        )}
        {timeAgo && (
         <div>
          <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-1.5">Requested At</div>
          <div className="text-[14px] text-foreground">{timeAgo}</div>
         </div>
        )}
        <div>
         <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-1.5">Status</div>
         <div className="text-[14px] text-foreground font-medium capitalize flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${
           status ==="approved" ?"bg-emerald-400" :
           status ==="rejected" ?"bg-red-400" :"bg-amber-400"
          }`} />
          {status === "proposed" ? "Pending Review" : status.replace(/_/g," ")}
         </div>
        </div>
        {isIssue && approval.priority && approval.priority !== "none" && (
         <div>
          <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-1.5">Priority</div>
          <div className="text-[14px] text-foreground capitalize">{approval.priority}</div>
         </div>
        )}
       </div>
      </section>
     </div>
    </div>
   </div>
  </main>
 );
}
