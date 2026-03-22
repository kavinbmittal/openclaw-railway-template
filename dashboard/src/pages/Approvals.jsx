import { useState, useEffect, useMemo } from"react";
import { ShieldCheck } from"lucide-react";
import { getApprovals, resolveApproval, updateIssue, deleteIssue, getThemes } from"../api.js";
import { RejectModal } from "../components/RejectModal.jsx";
import { formatTimeAgo } from"../utils/formatDate.js";

const THEME_COLORS = [
 { badgeBg: "bg-indigo-500/10", badgeBorder: "border-indigo-500/20", text: "text-indigo-400" },
 { badgeBg: "bg-emerald-500/10", badgeBorder: "border-emerald-500/20", text: "text-emerald-400" },
 { badgeBg: "bg-amber-500/10", badgeBorder: "border-amber-500/20", text: "text-amber-400" },
 { badgeBg: "bg-cyan-500/10", badgeBorder: "border-cyan-500/20", text: "text-cyan-400" },
 { badgeBg: "bg-rose-500/10", badgeBorder: "border-rose-500/20", text: "text-rose-400" },
];

const TYPE_BADGES = {
 "proposed-issue": { label: "Issue", cls: "border-violet-500/20 bg-violet-500/10 text-violet-400" },
 "experiment-start": { label: "Experiment", cls: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400" },
 "autoresearch-start": { label: "Experiment", cls: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400" },
 "proposed-theme": { label: "Theme", cls: "border-teal-500/20 bg-teal-500/10 text-teal-400" },
 theme: { label: "Theme", cls: "border-teal-500/20 bg-teal-500/10 text-teal-400" },
 "deliverable-review": { label: "Deliverable", cls: "border-blue-500/20 bg-blue-500/10 text-blue-400" },
};

export default function Approvals({ navigate }) {
 const [approvals, setApprovals] = useState([]);
 const [themesMap, setThemesMap] = useState({}); // { projectId: themes[] }
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [rejectingApproval, setRejectingApproval] = useState(null);
 const [tab, setTab] = useState("pending");

 function refresh() {
  setLoading(true);
  getApprovals()
   .then((data) => {
    setApprovals(data);
    // Fetch themes for each project
    const projects = [...new Set(data.map((a) => a._project || a.project).filter(Boolean))];
    Promise.all(projects.map((p) => getThemes(p).then((t) => [p, t]).catch(() => [p, []])))
     .then((results) => {
      const map = {};
      for (const [p, t] of results) map[p] = t;
      setThemesMap(map);
     });
   })
   .catch((e) => setError(e.message))
   .finally(() => setLoading(false));
 }

 useEffect(() => { refresh(); }, []);

 const pendingApprovals = useMemo(
  () => approvals.filter((a) => !a.status || a.status ==="pending"),
  [approvals]
 );

 const displayedApprovals = tab ==="pending" ? pendingApprovals : approvals;

 const grouped = useMemo(() => {
  const groups = {};
  for (const item of displayedApprovals) {
   const project = item._project || item.project ||"Unknown";
   if (!groups[project]) groups[project] = [];
   groups[project].push(item);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
 }, [displayedApprovals]);

 async function handleApprove(approval) {
  try {
   if (approval._source ==="issue") {
    await updateIssue(approval.id, approval._project || approval.project, { status:"todo" });
   } else {
    await resolveApproval({
     project: approval._project || approval.project,
     id: approval.id,
     decision:"approved",
     comment: null,
     requester: approval.requester,
     gate: approval.gate,
     what: approval.what || approval.title,
     why: approval.why,
     created: approval.created,
    });
   }
   refresh();
  } catch (err) {
   setError(err.message);
  }
 }

 async function handleReject(approval) {
  if (approval._source ==="issue") {
   try {
    await deleteIssue(approval.id, approval._project || approval.project);
    refresh();
   } catch (err) {
    setError(err.message);
   }
  } else {
   setRejectingApproval(approval);
  }
 }

 async function confirmReject(comment) {
  const approval = rejectingApproval;
  setRejectingApproval(null);
  try {
   await resolveApproval({
    project: approval._project || approval.project,
    id: approval.id,
    decision: "rejected",
    comment,
    requester: approval.requester,
    gate: approval.gate,
    what: approval.what || approval.title,
    why: approval.why,
    created: approval.created,
   });
   refresh();
  } catch (err) {
   setError(err.message);
  }
 }

 // Theme data lookup — same as ProjectApprovalsTab
 function getApprovalThemeData(approval, projectId) {
  const allThemes = themesMap[projectId] || [];
  const expTheme = allThemes.find((t) => t.id === approval.theme || t.title === approval.theme || t.id === approval.theme_id || t.title === approval.theme_title);
  if (!expTheme) return null;
  const sortedThemes = allThemes.filter((t) => t.status === "approved").sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const themeIdx = sortedThemes.indexOf(expTheme);
  const themeColors = THEME_COLORS[themeIdx >= 0 ? themeIdx % THEME_COLORS.length : 0];
  const sortedPms = (expTheme.proxy_metrics || []).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const proxyMetric = sortedPms.find((pm) =>
   pm.id === approval.proxy_metric || pm.name === approval.proxy_metric ||
   (approval.proxy_metrics && approval.proxy_metrics.some((apm) => (apm.id || apm) === pm.id || apm.name === pm.name)) ||
   (approval.proxy_metric_names && approval.proxy_metric_names.some((n) => n === pm.name || n === pm.id))
  );
  const pmIdx = proxyMetric ? sortedPms.indexOf(proxyMetric) : -1;
  return { expTheme, themeIdx, themeColors, proxyMetric, pmIdx };
 }

 if (loading && approvals.length === 0) {
  return (
   <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#09090b] relative">
    <header className="h-16 flex items-center justify-between px-8 border-b border-zinc-800 shrink-0 bg-[#09090b]/80 backdrop-blur-sm z-10 sticky top-0">
     <h1 className="text-[16px] font-medium uppercase tracking-[0.2em] text-zinc-100">Approvals</h1>
    </header>
    <div className="flex-1 overflow-y-auto p-8">
     <div className="max-w-4xl mx-auto">
      <div className="bg-[#121214] border border-zinc-800 rounded-[2px] shadow-sm p-[20px]">
       <div className="bg-zinc-800/50 h-4 w-48 mb-3 rounded-sm" />
       <div className="bg-zinc-800/50 h-4 w-32 rounded-sm" />
      </div>
     </div>
    </div>
   </div>
  );
 }

 const pendingCount = pendingApprovals.length;

 return (
  <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#09090b] relative">
   <header className="h-16 flex items-center justify-between px-8 border-b border-zinc-800 shrink-0 bg-[#09090b]/80 backdrop-blur-sm z-10 sticky top-0">
    <h1 className="text-[16px] font-medium uppercase tracking-[0.2em] text-zinc-100">Approvals</h1>
    <span className="text-[14px] text-zinc-400">
     {pendingCount > 0 ? `${pendingCount} pending` : "All clear"}
    </span>
   </header>

   <div className="flex-1 overflow-y-auto p-8">
    <div className="max-w-4xl mx-auto space-y-8 pb-12">

     {/* Tab toggle */}
     <div className="flex items-center gap-1 border-b border-zinc-800 pb-px">
      <button
       onClick={() => setTab("pending")}
       className={`px-3 py-2 text-[15px] font-medium transition-colors border-b-2 -mb-px ${tab === "pending" ? "border-zinc-100 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
      >
       Pending
       {pendingCount > 0 && (
        <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-amber-900/50 text-amber-300 text-[11px] font-medium px-1">
         {pendingCount}
        </span>
       )}
      </button>
      <button
       onClick={() => setTab("all")}
       className={`px-3 py-2 text-[15px] font-medium transition-colors border-b-2 -mb-px ${tab === "all" ? "border-zinc-100 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
      >
       All
      </button>
     </div>

     {error && (
      <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 rounded-[2px]">
       {error}
      </div>
     )}

     {grouped.length === 0 ? (
      <div className="flex flex-col items-center justify-center h-64 mt-12">
       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 mb-3">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
       </svg>
       <span className="text-[14px] text-zinc-400">
        {tab === "pending" ? "All clear — nothing needs your approval" : "No approvals"}
       </span>
      </div>
     ) : (
      grouped.map(([project, items]) => (
       <div key={project}>
        {/* Group Header */}
        <div className="flex items-center gap-3 px-5 py-3 mb-3 bg-[#121214] border border-zinc-800 rounded-[2px]">
         <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
         </div>
         <button
          onClick={() => navigate("project", project)}
          className="text-[15px] font-medium text-amber-100 hover:text-white transition-colors flex-1 text-left"
         >
          {project}
         </button>
         <span className="text-[10px] font-mono bg-zinc-800 px-1.5 py-0.5 rounded-[2px] text-zinc-400">
          {items.length}
         </span>
        </div>

        {/* Approval Cards — exact same rendering as ProjectApprovalsTab */}
        <div className="space-y-4">
         {items.map((approval) => {
          const isPending = !approval.status || approval.status === "pending" || approval.status === "proposed";
          const isRejected = approval.status === "rejected";
          const title = approval.what || approval.title || "";
          const itemType = approval.type || approval.gate || null;
          const ta = approval.created ? formatTimeAgo(approval.created) : approval.timestamp ? formatTimeAgo(approval.timestamp) : "";
          const td = getApprovalThemeData(approval, project);
          const badge = TYPE_BADGES[itemType] || (itemType ? { label: itemType, cls: "border-amber-500/20 bg-amber-500/10 text-amber-400" } : null);

          return (
           <div
            key={approval.id || approval._file}
            className={`bg-[#121214] border border-zinc-800 rounded-[2px] p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-sm ${isRejected ? "opacity-60" : ""}`}
            onClick={() => navigate && navigate("approval-detail", approval.id)}
           >
            <div className="space-y-2.5 cursor-pointer">
             {badge && (
              <div>
               <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.cls}`}>{badge.label}</span>
              </div>
             )}
             <p className={`text-sm font-medium text-zinc-100 ${isRejected ? "line-through decoration-zinc-500" : ""}`}>{title}</p>

             {/* Theme + Proxy Metric pill row — copied from ProjectApprovalsTab */}
             {td && (
              <div className="flex flex-wrap items-center gap-2">
               <div className="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-zinc-800/40 border border-zinc-700/30">
                <div className={`w-3.5 h-3.5 rounded-full ${td.themeColors.badgeBg} border ${td.themeColors.badgeBorder} flex items-center justify-center text-[9px] font-mono font-medium ${td.themeColors.text} flex-shrink-0`}>
                 {td.expTheme.order ?? td.themeIdx + 1}
                </div>
                <span className="text-xs text-zinc-300">{td.expTheme.title}</span>
               </div>
               {td.proxyMetric && (
                <>
                 <span className="text-zinc-600 text-sm">{"\u203A"}</span>
                 <div className="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-zinc-800/40 border border-zinc-700/30">
                  <div className="w-3.5 h-3.5 rounded bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center text-[9px] font-mono text-zinc-500 flex-shrink-0">
                   {String.fromCharCode(97 + (td.pmIdx >= 0 ? td.pmIdx : 0))}
                  </div>
                  <span className="text-xs text-zinc-400">{td.proxyMetric.name}</span>
                 </div>
                </>
               )}
              </div>
             )}

             <div className="text-xs text-zinc-500 flex items-center gap-2 pt-0.5">
              {approval.requester && <span>Requested by: {approval.requester}</span>}
              {approval.requester && ta && <span>&middot;</span>}
              {ta && <span>{ta}</span>}
             </div>

             {isRejected && approval.comment && (
              <div className="text-xs text-red-400 flex items-center gap-1.5 mt-2 bg-red-500/10 px-3 py-1.5 rounded-[4px] border border-red-500/20 inline-flex w-fit">
               Rejected: {approval.comment}
              </div>
             )}
            </div>

            {/* Right: action buttons */}
            {isPending && (
             <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
               onClick={() => handleReject(approval)}
               className="px-4 py-1.5 rounded-[6px] border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors text-sm font-medium focus:outline-none focus:ring-[3px] focus:ring-red-500/30"
              >
               Reject
              </button>
              <button
               onClick={() => handleApprove(approval)}
               className="px-4 py-1.5 rounded-[6px] border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors text-sm font-medium focus:outline-none focus:ring-[3px] focus:ring-emerald-500/30"
              >
               Approve
              </button>
             </div>
            )}
           </div>
          );
         })}
        </div>
       </div>
      ))
     )}
    </div>
   </div>

   {rejectingApproval && (
    <RejectModal
     onConfirm={confirmReject}
     onCancel={() => setRejectingApproval(null)}
    />
   )}
  </div>
 );
}
