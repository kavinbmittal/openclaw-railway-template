import { useState, useEffect, useMemo } from"react";
import { Compass, ShieldCheck } from"lucide-react";
import { getApprovals, resolveApproval, updateIssue, deleteIssue } from"../api.js";
import { RejectModal } from "../components/RejectModal.jsx";

const TYPE_STYLES = {
 budget: "border-amber-500/20 bg-amber-500/10 text-amber-400",
 deliverable: "border-blue-500/20 bg-blue-500/10 text-blue-400",
 issue: "border-violet-500/20 bg-violet-500/10 text-violet-400",
 experiment: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
};

function typeStyle(type) {
 const key = (type || "").toLowerCase();
 return TYPE_STYLES[key] || "border-zinc-500/20 bg-zinc-500/10 text-zinc-400";
}

function timeAgo(dateStr) {
 if (!dateStr) return "";
 const diff = Date.now() - new Date(dateStr).getTime();
 const mins = Math.floor(diff / 60000);
 if (mins < 60) return `${mins}m ago`;
 const hrs = Math.floor(mins / 60);
 if (hrs < 24) return `${hrs}h ago`;
 return `${Math.floor(hrs / 24)}d ago`;
}

export default function Approvals({ navigate }) {
 const [approvals, setApprovals] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [rejectingApproval, setRejectingApproval] = useState(null);
 const [tab, setTab] = useState("pending");

 function refresh() {
  setLoading(true);
  getApprovals()
   .then(setApprovals)
   .catch((e) => setError(e.message))
   .finally(() => setLoading(false));
 }

 useEffect(() => {
  refresh();
 }, []);

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
    await updateIssue(
     approval.id,
     approval._project || approval.project,
     { status:"todo" }
    );
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
    await deleteIssue(
     approval.id,
     approval._project || approval.project
    );
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

 /* Loading skeleton — Aura style */
 if (loading && approvals.length === 0) {
  return (
   <div className="flex-1 flex flex-col h-full overflow-hidden bg-background relative">
    <header className="h-16 flex items-center justify-between px-8 border-b border-border shrink-0 bg-background/80 backdrop-blur-sm z-10 sticky top-0">
     <h1 className="text-[16px] font-medium uppercase tracking-[0.2em] text-zinc-100">Approvals</h1>
    </header>
    <div className="flex-1 overflow-y-auto p-8">
     <div className="max-w-4xl mx-auto">
      <div className="bg-card border border-border rounded-[2px] shadow-sm p-[20px]">
       <div className="bg-zinc-800/50 h-4 w-48 mb-3 rounded-[2px]" />
       <div className="bg-zinc-800/50 h-4 w-32 rounded-[2px]" />
      </div>
     </div>
    </div>
   </div>
  );
 }

 const pendingCount = pendingApprovals.length;

 return (
  <div className="flex-1 flex flex-col h-full overflow-hidden bg-background relative">
   {/* Page Header — Aura */}
   <header className="h-16 flex items-center justify-between px-8 border-b border-border shrink-0 bg-background/80 backdrop-blur-sm z-10 sticky top-0">
    <h1 className="text-[16px] font-medium uppercase tracking-[0.2em] text-zinc-100">Approvals</h1>
    <span className="text-[14px] text-zinc-400">
     {pendingCount > 0 ? `${pendingCount} pending` : "All clear"}
    </span>
   </header>

   {/* Content Area — Aura */}
   <div className="flex-1 overflow-y-auto p-8">
    <div className="max-w-4xl mx-auto space-y-8 pb-12">

     {/* Tab toggle */}
     <div className="flex items-center gap-1 border-b border-border pb-px">
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
      <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-[14px] text-red-400 rounded-[2px]">
       {error}
      </div>
     )}

     {grouped.length === 0 ? (
      /* Empty state — Aura */
      <div className="flex flex-col items-center justify-center py-16">
       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 mb-3">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
       </svg>
       <span className="text-[14px] text-muted-foreground">
        {tab === "pending" ? "All clear — nothing needs your approval" : "No approvals"}
       </span>
      </div>
     ) : (
      /* Project groups — Aura */
      grouped.map(([project, items]) => (
       <div key={project} className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
        {/* Group Header — Aura */}
        <div className="flex items-center gap-3 px-5 py-3 bg-amber-500/[0.02] transition-colors">
         <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
         </div>
         <button
          onClick={() => navigate("project", project)}
          className="text-[15px] font-medium text-amber-100 hover:text-white transition-colors flex-1 text-left"
         >
          {project}
         </button>
         <span className="text-[11px] font-mono bg-zinc-800 px-1.5 py-0.5 rounded-[2px] text-zinc-400">
          {items.length}
         </span>
        </div>

        {/* Approval Rows — Aura */}
        <div className="flex flex-col">
         {items.map((approval, i) => (
          <div
           key={approval.id || approval._file || i}
           className={`flex flex-col gap-3 px-[20px] py-4 hover:bg-zinc-800/40 transition-colors cursor-pointer ${i < items.length - 1 ? "border-b border-border/50" : ""}`}
           onClick={() => navigate("approval-detail", approval.id || approval._file)}
          >
           <div className="flex items-center gap-4">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-normal border shrink-0 ${typeStyle(approval._source || approval.gate || approval.type)}`}>
             {approval._source || approval.gate || approval.type || "request"}
            </span>
            <span className="text-[15px] font-medium text-zinc-200 flex-1 truncate">
             {approval.what || approval.title}
            </span>
            <span className="text-[12px] font-mono text-zinc-500 shrink-0">
             {timeAgo(approval.created)}
            </span>
           </div>
           {/* Theme + proxy metrics pills */}
           {(approval.theme_title || (approval.proxy_metric_names && approval.proxy_metric_names.length > 0)) && (
            <div className="flex items-center gap-2 flex-wrap">
             {approval.theme_title && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border border-teal-500/20 bg-teal-500/10 text-teal-400">
               <Compass size={10} />
               {approval.theme_title}
              </span>
             )}
             {approval.proxy_metric_names && approval.proxy_metric_names.map((pm, j) => (
              <span key={j} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border border-zinc-700 bg-zinc-800/50 text-zinc-400">
               {pm}
              </span>
             ))}
            </div>
           )}
           <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
              <rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h6"/>
             </svg>
             <span className="text-[15px] text-zinc-400">
              Requested by {approval.requester || "agent"}
             </span>
            </div>
            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
             <button
              onClick={() => handleReject(approval)}
              className="px-3 py-1.5 rounded-[6px] border border-red-500/30 bg-red-500/10 text-[15px] font-normal text-red-400 hover:bg-red-500/20 transition-colors"
             >
              Reject
             </button>
             <button
              onClick={() => handleApprove(approval)}
              className="px-3 py-1.5 rounded-[6px] border border-emerald-500/30 bg-emerald-500/10 text-[15px] font-normal text-emerald-400 hover:bg-emerald-500/20 transition-colors"
             >
              Approve
             </button>
            </div>
           </div>
          </div>
         ))}
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
