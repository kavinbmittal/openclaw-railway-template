/**
 * ApprovalDetail — single approval view with two-panel layout.
 * UI ported from Aura HTML reference.
 */
import { useState, useEffect } from"react";
import { CheckCircle2, XCircle, RotateCcw, Loader2, CircleDot, FlaskConical, FileText, Compass, BarChart3, Clock, ShieldCheck } from"lucide-react";
import { getApprovalDetail, resolveApproval, requestRevision, updateIssue, deleteIssue, resolveTheme, getThemes } from"../api.js";
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
  <span className="px-1.5 py-0.5 rounded border border-zinc-700/80 bg-zinc-800/50 text-zinc-300 text-[11px] font-mono tracking-wide leading-tight">
   {type.toUpperCase().replace(/-/g,"_")}
  </span>
 );
}

export default function ApprovalDetail({ approvalId, navigate }) {
 const [approval, setApproval] = useState(null);
 const [themes, setThemes] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [comment, setComment] = useState("");
 const [submitting, setSubmitting] = useState(false);
 const [resolved, setResolved] = useState(null);

 useEffect(() => {
  setLoading(true);
  setError(null);
  getApprovalDetail(approvalId)
   .then((data) => {
    setApproval(data);
    const proj = data._project || data.project;
    if (proj) getThemes(proj).then(setThemes).catch(() => {});
   })
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
    <div className="bg-zinc-800/50 h-4 w-48 rounded-[2px]" />
    <div className="bg-zinc-800/50 h-8 w-96 rounded-[2px]" />
    <div className="bg-zinc-800/50 h-4 w-64 rounded-[2px]" />
    <div className="bg-zinc-800/50 h-64 w-full rounded-[2px] mt-4" />
   </div>
  );
 }

 if (!approval) {
  return (
   <div className="max-w-[1200px] mx-auto">
    <p className="text-[14px] text-zinc-500">{error ||"Approval not found."}</p>
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
  <div className="flex flex-col h-full">
   {/* Page Header — Aura: px-8 py-8 border-b, sticky */}
   <header className="px-8 py-8 border-b border-border shrink-0 bg-background">
    {/* Breadcrumb */}
    <nav className="flex items-center text-[15px] text-zinc-400 mb-5 tracking-wide">
     <button onClick={() => navigate("approvals")} className="hover:text-zinc-100 transition-colors">Approvals</button>
     {projectName && (
      <>
       <span className="mx-2 text-zinc-600">&rsaquo;</span>
       <button onClick={() => navigate("project", projectName)} className="hover:text-zinc-100 transition-colors capitalize">{projectName}</button>
      </>
     )}
     <span className="mx-2 text-zinc-600">&rsaquo;</span>
     <span className="text-zinc-100 font-semibold truncate">{title}</span>
    </nav>

    {/* Title + Status Badge — Aura: text-[30px] + bordered pill */}
    <div className="flex items-center gap-4 mb-4">
     <h1 className="text-[30px] font-semibold text-zinc-100 leading-none tracking-tight">{title}</h1>
     <StatusBadgeInline status={status} />
    </div>

    {/* Metadata — Aura: text-[15px] with type label + dot separators */}
    <div className="flex items-center gap-2 text-[15px] text-zinc-500">
     <TypeLabel type={itemType} />
     {approval.requester && (
      <>
       <span className="text-zinc-600">&middot;</span>
       <span>Requested by{" "}
        <button
         className="text-zinc-100 font-medium hover:underline capitalize"
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
       <span className="text-zinc-600">&middot;</span>
       <span>{timeAgo}</span>
      </>
     )}
    </div>
   </header>

   {/* Scrollable Content — Aura: grid-cols-3 */}
   <div className="flex-1 overflow-y-auto p-8">

    {/* Theme & Proxy Metric cards — from Aura HTML */}
    {(() => {
     const themeId = approval.theme || approval.theme_id;
     const themeTitle = approval.theme_title;
     const approvalTheme = themeId || themeTitle ? themes.find((t) => t.id === themeId || t.title === themeId || t.title === themeTitle) : null;
     const sortedThemes = themes.filter((t) => t.status === "approved").sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
     const themeIdx = approvalTheme ? sortedThemes.indexOf(approvalTheme) : -1;
     const TC = [
      { iconBg: "bg-indigo-500/10", iconBorder: "border-indigo-500/20", iconText: "text-indigo-400" },
      { iconBg: "bg-emerald-500/10", iconBorder: "border-emerald-500/20", iconText: "text-emerald-400" },
      { iconBg: "bg-amber-500/10", iconBorder: "border-amber-500/20", iconText: "text-amber-400" },
      { iconBg: "bg-cyan-500/10", iconBorder: "border-cyan-500/20", iconText: "text-cyan-400" },
      { iconBg: "bg-rose-500/10", iconBorder: "border-rose-500/20", iconText: "text-rose-400" },
     ];
     const colors = themeIdx >= 0 ? TC[themeIdx % TC.length] : TC[0];
     const sortedPms = approvalTheme ? (approvalTheme.proxy_metrics || []).sort((a, b) => (a.order ?? 999) - (b.order ?? 999)) : [];
     // proxy_metrics (objects) for experiments/themes, proxy_metric_names (strings) for proposed issues
     const rawPms = approval.proxy_metrics || (approval.proxy_metric_names || []).map((n) => ({ id: n, name: n }));
     const approvalPms = rawPms.map((pm) => {
      const pmId = typeof pm === "string" ? pm : pm.id;
      const found = sortedPms.find((p) => p.id === pmId || p.name === pmId || p.name === pm.name);
      return found || { id: pmId, name: pm.name || pmId };
     });
     const firstPm = approvalPms[0];
     const firstPmIdx = firstPm ? sortedPms.findIndex((p) => p.id === firstPm.id) : -1;

     if (!approvalTheme && approvalPms.length === 0) return null;

     return (
      <div className="max-w-[1200px] grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
       {approvalTheme && (
        <div className="bg-app-card border border-border rounded-[2px] shadow-sm p-[20px] flex items-start gap-4">
         <div className={`w-10 h-10 rounded-full ${colors.iconBg} border ${colors.iconBorder} flex items-center justify-center shrink-0`}>
          <span className={`text-lg font-mono font-medium ${colors.iconText}`}>{approvalTheme.order ?? themeIdx + 1}</span>
         </div>
         <div>
          <h3 className="text-[12px] uppercase font-mono tracking-widest text-zinc-500 mb-1">Theme</h3>
          <p className="text-base font-medium text-zinc-100 mb-1">{approvalTheme.title}</p>
          {approvalTheme.description && (
           <p className="text-[12px] text-zinc-400 leading-relaxed">{approvalTheme.description}</p>
          )}
         </div>
        </div>
       )}
       {approvalPms.length > 0 && (
        <div className="bg-app-card border border-border rounded-[2px] shadow-sm p-[20px]">
         <h3 className="text-[12px] uppercase font-mono tracking-widest text-zinc-500 mb-3">Proxy Metrics</h3>
         <div className="space-y-2">
          {approvalPms.map((pm, i) => {
           const pmIdx = sortedPms.findIndex((p) => p.id === pm.id);
           return (
            <div key={i} className="flex items-center gap-3">
             <span className="w-6 h-6 rounded-full bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center shrink-0 text-[12px] font-mono text-zinc-400">{pmIdx >= 0 ? String.fromCharCode(97 + pmIdx) : "—"}</span>
             <div>
              <p className="text-[14px] font-medium text-zinc-100">{pm.name}</p>
              {pm.target && <p className="text-[12px] text-zinc-500">Theme target: {pm.target}</p>}
              {pm.contribution && <p className="text-[12px] text-teal-400">Contribution: {pm.contribution}</p>}
             </div>
            </div>
           );
          })}
         </div>
        </div>
       )}
      </div>
     );
    })()}

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
         <span className="text-[14px] font-medium text-zinc-100">
          {resolved.decision ==="approved"
           ? (isThemeProposal ? "Theme approved" : isIssue ?"Issue approved — moved to todo" :"Approved")
           : resolved.decision ==="revision_requested" ?"Revision Requested"
           : (isThemeProposal ? "Theme rejected" : isIssue ?"Issue rejected — removed" :"Rejected")}
         </span>
         {resolved.comment && (
          <span className="text-[15px] text-zinc-500 ml-2">— {resolved.comment}</span>
         )}
        </div>
       </div>
      )}

      {/* Experiment — new structured format (hypothesis + program + proxy targets) */}
      {isExperiment && approval.hypothesis && (
       <>
        <section className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
         <header className="flex items-center gap-3 px-5 py-3 bg-amber-500/[0.02] transition-colors">
          <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
           <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-[15px] font-medium text-amber-100">Experiment</div>
         </header>
         <div className="p-[20px] space-y-5">
          <div>
           <h3 className="text-[11px] uppercase tracking-[0.15em] font-mono text-zinc-500 mb-2">Hypothesis</h3>
           <p className="text-[14px] text-zinc-300">{approval.hypothesis}</p>
          </div>
          <div>
           <h3 className="text-[11px] uppercase tracking-[0.15em] font-mono text-zinc-500 mb-2">Program</h3>
           <div className="mc-prose">
            <Markdown content={approval.program || ""} />
           </div>
          </div>
         </div>
        </section>
        {/* Proxy metric contributions for experiment */}
        {approval.proxy_metrics && approval.proxy_metrics.length > 0 && (approval.proxy_metrics[0]?.contribution || approval.proxy_metrics[0]?.target) && (
         <section className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
          <header className="flex items-center gap-3 px-5 py-3 bg-amber-500/[0.02] transition-colors">
           <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
           </div>
           <div className="text-[15px] font-medium text-amber-100">Contributions</div>
          </header>
          <div className="p-[20px] space-y-3">
           {approval.proxy_metrics.map((pm, i) => (
            <div key={pm.id || i} className="p-3 border border-border/60 bg-zinc-800/10 rounded-[2px]">
             <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
               <BarChart3 size={14} className="text-teal-400 shrink-0" />
               <span className="text-[14px] font-medium text-zinc-100">{pm.name || pm.id}</span>
              </div>
              <span className="text-[14px] font-mono text-teal-400">{pm.contribution || pm.target}</span>
             </div>
             {pm.target && pm.contribution && (
              <p className="text-[12px] text-zinc-500 ml-[26px] mt-1">Theme target: {pm.target}</p>
             )}
            </div>
           ))}
          </div>
         </section>
        )}
       </>
      )}

      {/* Details Card — Aura card (fallback for old experiments with `why`, non-experiment gates, issues) */}
      {approval.why && !(isExperiment && approval.hypothesis) && (
       <section className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
        <header className="flex items-center gap-3 px-5 py-3 bg-amber-500/[0.02] transition-colors">
         <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <FileText className="w-3.5 h-3.5 text-amber-400" />
         </div>
         <div className="text-[15px] font-medium text-amber-100">
          {isExperiment ?"Approval Request" : isDeliverable ?"Deliverable" : isIssue ?"Proposed Issue" :"Details"}
         </div>
        </header>
        <div className="p-[20px] text-[14px] text-zinc-300 leading-relaxed space-y-5 mc-prose">
         <Markdown content={approval.why} />
        </div>
       </section>
      )}

      {/* Theme proposal — proxy metrics */}
      {isTheme && (
       <section className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
        <header className="flex items-center gap-3 px-5 py-3 bg-amber-500/[0.02] transition-colors">
         <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Compass className="w-3.5 h-3.5 text-amber-400" />
         </div>
         <div className="text-[15px] font-medium text-amber-100">Theme Details</div>
        </header>
        <div className="p-[20px] space-y-5">
         {approval.description && (
          <p className="text-[14px] text-zinc-300">{approval.description}</p>
         )}
         {approval.proxy_metrics && approval.proxy_metrics.length > 0 && (
          <div>
           <h3 className="text-[11px] uppercase tracking-[0.15em] font-mono text-zinc-500 mb-3">
            Proxy Metrics
           </h3>
           <div className="space-y-3">
            {approval.proxy_metrics.map((pm, i) => (
             <div key={pm.id || i} className="flex items-start gap-3 p-3 border border-border/60 bg-zinc-800/10 rounded-[2px]">
              <BarChart3 size={14} className="text-teal-400 mt-0.5 shrink-0" />
              <div>
               <p className="text-[14px] font-medium text-zinc-100">{pm.name}</p>
               {pm.description && <p className="text-[15px] text-zinc-500 mt-0.5">{pm.description}</p>}
              </div>
             </div>
            ))}
           </div>
          </div>
         )}
        </div>
       </section>
      )}

      {/* Experiment Plan — strip sections shown in their own cards */}
      {isExperiment && approval.programMd && (() => {
       const stripped = approval.programMd
        .replace(/^#[^\n]*\n/m, "") // Remove title line
        .replace(/## Theme\s*\n[\s\S]*?(?=\n##|$)/, "")
        .replace(/## Proxy Metrics\s*\n[\s\S]*?(?=\n##|$)/, "")
        .replace(/## Hypothesis\s*\n[\s\S]*?(?=\n##|$)/, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
       return stripped ? (
        <section className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
         <header className="flex items-center gap-3 px-5 py-3 bg-amber-500/[0.02] transition-colors">
          <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
           <FileText className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-[15px] font-medium text-amber-100">Experiment Plan</div>
         </header>
         <div className="p-[20px] mc-prose">
          <Markdown content={stripped} />
         </div>
        </section>
       ) : null;
      })()}

      {/* Theme + proxy metrics are shown in the grid above (line ~241) */}

      {/* Already resolved info */}
      {!isPending && !isRevisionRequested && !resolved && (
       <div className="bg-card border border-border rounded-[2px] shadow-sm p-[20px]">
        <div className="flex items-center gap-2">
         {status ==="approved" ? <CheckCircle2 size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-red-400" />}
         <span className="text-[14px] font-medium capitalize">{status}</span>
         {approval.resolved_at && <span className="text-[15px] text-zinc-500 ml-2">{formatTimeAgo(approval.resolved_at)}</span>}
        </div>
        {approval.comment && <p className="text-[14px] text-zinc-500 mt-2">Note: {approval.comment}</p>}
       </div>
      )}

      {/* Revision requested */}
      {isRevisionRequested && !resolved && (
       <div className="border border-amber-500/20 bg-amber-500/5 rounded-[2px] p-[20px]">
        <div className="flex items-center gap-2">
         <RotateCcw size={16} className="text-amber-400" />
         <span className="text-[14px] font-medium text-amber-300">Revision Requested</span>
         {approval.revision_requested_at && <span className="text-[15px] text-zinc-500 ml-2">{formatTimeAgo(approval.revision_requested_at)}</span>}
        </div>
        {approval.revision_feedback && <p className="text-[14px] text-zinc-500 mt-2">Feedback: {approval.revision_feedback}</p>}
        <p className="text-[15px] text-zinc-500 mt-3">Waiting for {approval.requester ||"agent"} to resubmit.</p>
       </div>
      )}
     </div>

     {/* Right Column — 1/3 */}
     <div className="xl:col-span-1 space-y-6">

      {/* Actions Card — Aura: sticky, approve/reject buttons */}
      {isPending && !resolved && (
       <section className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col sticky top-0">
        <header className="flex items-center gap-3 px-5 py-3 bg-amber-500/[0.02] transition-colors">
         <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
         </div>
         <div className="text-[15px] font-medium text-amber-100">Actions</div>
        </header>
        <div className="p-[20px] space-y-3">
         <button
          onClick={() => handleResolve("approved")}
          disabled={submitting}
          className="w-full py-2.5 rounded-[6px] border border-emerald-500/30 bg-emerald-500/10 text-[14px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all flex justify-center items-center gap-2 outline-none focus-visible:ring-[3px] focus-visible:ring-emerald-500/50 disabled:opacity-50"
         >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          {isThemeProposal ? "Approve Theme" : isIssue ?"Approve Issue" :"Approve Request"}
         </button>

         {!isIssue && (
          <button
           onClick={() => handleResolve("revision_requested")}
           disabled={submitting || !comment.trim()}
           className="w-full py-2.5 rounded-[6px] border border-amber-500/30 bg-amber-500/10 text-[14px] font-medium text-amber-400 hover:bg-amber-500/20 transition-all flex justify-center items-center gap-2 outline-none focus-visible:ring-[3px] focus-visible:ring-amber-500/50 disabled:opacity-50"
          >
           {submitting ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
           Request Revision
          </button>
         )}

         <button
          onClick={() => handleResolve("rejected")}
          disabled={submitting || (!isIssue && !isThemeProposal && !comment.trim())}
          className="w-full py-2.5 rounded-[6px] border border-red-500/30 bg-red-500/10 text-[14px] font-medium text-red-400 hover:bg-red-500/20 transition-all flex justify-center items-center gap-2 outline-none focus-visible:ring-[3px] focus-visible:ring-red-500/50 disabled:opacity-50"
         >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
          {isThemeProposal ? "Reject Theme" : isIssue ?"Reject Issue" :"Reject Request"}
         </button>

         {/* Comment textarea — Aura style */}
         {!isIssue && (
          <div className="pt-4 mt-2 border-t border-border/60 flex flex-col gap-3">
           <label className="text-[12px] font-medium text-zinc-500 flex items-center justify-between">
            {isThemeProposal ?"Feedback" :"Rejection Comment"}
            <span className="text-zinc-600 font-normal text-[11px]">{isIssue ?"" : isThemeProposal ?"Optional" :"Required"}</span>
           </label>
           <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-[6px] border border-border bg-background text-[14px] text-zinc-200 p-3 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-all resize-none h-20"
            placeholder="Provide context..."
           />
          </div>
         )}

         {error && <p className="text-[15px] text-red-400 mt-2">{error}</p>}
        </div>
       </section>
      )}

      {/* Info Card — Aura: p-[20px] space-y-5 with mono labels */}
      <section className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
       <div className="p-[20px] space-y-5">
        <div>
         <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-zinc-500 mb-1.5">Type</div>
         <div className="text-[14px] text-zinc-200 capitalize">{itemType ? itemType.replace(/-/g," ") :"Approval"}</div>
        </div>
        {projectName && (
         <div>
          <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-zinc-500 mb-1.5">Project</div>
          <button
           onClick={() => navigate("project", projectName)}
           className="text-[14px] text-zinc-200 hover:underline capitalize"
          >
           {projectName}
          </button>
         </div>
        )}
        {approval.requester && (
         <div>
          <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-zinc-500 mb-1.5">Requested By</div>
          <div className="text-[14px] text-zinc-200 capitalize">{approval.requester}</div>
         </div>
        )}
        {timeAgo && (
         <div>
          <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-zinc-500 mb-1.5">Requested At</div>
          <div className="text-[14px] text-zinc-200">{timeAgo}</div>
         </div>
        )}
        <div>
         <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-zinc-500 mb-1.5">Status</div>
         <div className="text-[14px] text-zinc-200 font-medium capitalize flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${
           status ==="approved" ?"bg-emerald-400" :
           status ==="rejected" ?"bg-red-400" :"bg-amber-400"
          }`} />
          {status === "proposed" ? "Pending Review" : status.replace(/_/g," ")}
         </div>
        </div>
        {isIssue && approval.priority && approval.priority !== "none" && (
         <div>
          <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-zinc-500 mb-1.5">Priority</div>
          <div className="text-[14px] text-zinc-200 capitalize">{approval.priority}</div>
         </div>
        )}
       </div>
      </section>
     </div>
    </div>
   </div>
  </div>
 );
}
