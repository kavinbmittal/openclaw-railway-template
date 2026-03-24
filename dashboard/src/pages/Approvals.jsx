import { useState, useEffect, useMemo } from"react";
import { ShieldCheck, CheckCircle } from"lucide-react";
import { getApprovals, resolveApproval, updateIssue, deleteIssue, getThemes } from"../api.js";
import { RejectModal } from "../components/RejectModal.jsx";

const THEME_COLORS = [
 { badgeBg: "bg-indigo-500/10", badgeBorder: "border-indigo-500/20", text: "text-indigo-400", headerBg: "bg-indigo-500/[0.02]", titleText: "text-indigo-100" },
 { badgeBg: "bg-emerald-500/10", badgeBorder: "border-emerald-500/20", text: "text-emerald-400", headerBg: "bg-emerald-500/[0.02]", titleText: "text-emerald-100" },
 { badgeBg: "bg-amber-500/10", badgeBorder: "border-amber-500/20", text: "text-amber-400", headerBg: "bg-amber-500/[0.02]", titleText: "text-amber-100" },
 { badgeBg: "bg-cyan-500/10", badgeBorder: "border-cyan-500/20", text: "text-cyan-400", headerBg: "bg-cyan-500/[0.02]", titleText: "text-cyan-100" },
 { badgeBg: "bg-rose-500/10", badgeBorder: "border-rose-500/20", text: "text-rose-400", headerBg: "bg-rose-500/[0.02]", titleText: "text-rose-100" },
];

const TYPE_STYLES = {
 budget: "border-amber-500/20 bg-amber-500/10 text-amber-400",
 deliverable: "border-blue-500/20 bg-blue-500/10 text-blue-400",
 issue: "border-violet-500/20 bg-violet-500/10 text-violet-400",
 experiment: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
 theme: "border-indigo-500/20 bg-indigo-500/10 text-indigo-400",
};

// Map raw source/gate values to friendly labels and style keys
function resolveType(approval) {
 const source = approval._source || "";
 const gate = (approval.gate || approval.type || "").toLowerCase();
 if (source === "issue") return { label: "Issue", key: "issue" };
 if (source === "theme") return { label: "Theme", key: "theme" };
 if (gate.includes("experiment") || gate.includes("autoresearch")) return { label: "Experiment", key: "experiment" };
 if (gate.includes("budget")) return { label: "Budget", key: "budget" };
 if (gate.includes("deliverable") || source === "deliverables") return { label: "Deliverable", key: "deliverable" };
 return { label: gate || source || "request", key: gate || source };
}

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
 const [projectThemes, setProjectThemes] = useState({});

 function refresh() {
  setLoading(true);
  getApprovals()
   .then((items) => {
    setApprovals(items);
    const projects = [...new Set(items.map((a) => a._project || a.project).filter(Boolean))];
    Promise.all(projects.map((p) => getThemes(p).then((themes) => [p, themes]).catch(() => [p, []])))
     .then((pairs) => setProjectThemes(Object.fromEntries(pairs)));
   })
   .catch((e) => setError(e.message))
   .finally(() => setLoading(false));
 }

 useEffect(() => {
  refresh();
 }, []);

 // Resolve theme info for an approval
 function getThemeInfo(approval) {
  const project = approval._project || approval.project;
  const themes = (projectThemes[project] || []).filter((t) => t.status === "approved").sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const theme = themes.find((t) => t.title === approval.theme_title || t.id === approval.theme || t.id === approval.theme_id);
  if (!theme) return null;
  const idx = themes.indexOf(theme);
  const colors = THEME_COLORS[idx >= 0 ? idx % THEME_COLORS.length : 0];
  return { theme, idx, colors };
 }

 // Get the theme key for grouping
 function themeKey(approval) {
  return approval.theme_title || approval.theme || approval.theme_id || "_untagged";
 }

 const pendingApprovals = useMemo(
  () => approvals.filter((a) => !a.status || a.status ==="pending" || a.status === "revision_requested"),
  [approvals]
 );

 const displayedApprovals = tab ==="pending" ? pendingApprovals : approvals;

 // Group by project, then by theme within each project
 const grouped = useMemo(() => {
  const projects = {};
  for (const item of displayedApprovals) {
   const project = item._project || item.project ||"Unknown";
   if (!projects[project]) projects[project] = {};
   const tk = themeKey(item);
   if (!projects[project][tk]) projects[project][tk] = [];
   projects[project][tk].push(item);
  }
  // Sort projects, then sort themes within each project by theme order
  return Object.entries(projects).sort(([a], [b]) => a.localeCompare(b)).map(([project, themeGroups]) => {
   const sortedThemes = Object.entries(themeGroups).sort(([a], [b]) => {
    if (a === "_untagged") return 1;
    if (b === "_untagged") return -1;
    return a.localeCompare(b);
   });
   return { project, themeGroups: sortedThemes, total: displayedApprovals.filter((a) => (a._project || a.project) === project).length };
  });
 }, [displayedApprovals, projectThemes]);

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

 /* Loading skeleton */
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
   {/* Page Header */}
   <header className="h-16 flex items-center justify-between px-8 border-b border-border shrink-0 bg-background/80 backdrop-blur-sm z-10 sticky top-0">
    <h1 className="text-[16px] font-medium uppercase tracking-[0.2em] text-zinc-100">Approvals</h1>
    <span className="text-[14px] text-zinc-400">
     {pendingCount > 0 ? `${pendingCount} pending` : "All clear"}
    </span>
   </header>

   {/* Content Area */}
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
      /* Empty state */
      <div className="flex flex-col items-center justify-center py-16">
       <CheckCircle className="text-emerald-500 w-6 h-6 mb-3" />
       <span className="text-[14px] text-muted-foreground">
        {tab === "pending" ? "All clear — nothing needs your approval" : "No approvals"}
       </span>
      </div>
     ) : (
      /* Project → Theme groups */
      grouped.map(({ project, themeGroups, total }) => (
       <div key={project} className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
        {/* Project Header */}
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
          {total}
         </span>
        </div>

        {/* Theme sub-groups stacked inside */}
        <div className="flex flex-col">
         {themeGroups.map(([themeName, items], gi) => {
          // Get theme colors from first item that has theme info
          const sampleApproval = items.find((a) => a.theme_title || a.theme);
          const ti = sampleApproval ? getThemeInfo(sampleApproval) : null;
          const colors = ti ? ti.colors : null;
          const isUntagged = themeName === "_untagged";

          return (
           <div key={themeName} className={gi < themeGroups.length - 1 ? "border-b border-border/50" : ""}>
            {/* Theme sub-header */}
            <div className={`flex items-center gap-2.5 px-5 py-2.5 ${colors ? colors.headerBg : "bg-zinc-500/[0.02]"} transition-colors`}>
             {!isUntagged && (
              <div className={`w-3.5 h-3.5 rounded-full ${colors ? colors.badgeBg : "bg-zinc-800/50"} border ${colors ? colors.badgeBorder : "border-zinc-700/50"} flex items-center justify-center text-[9px] font-mono font-medium ${colors ? colors.text : "text-zinc-500"} flex-shrink-0`}>
               {ti ? (ti.theme.order ?? ti.idx + 1) : "?"}
              </div>
             )}
             <span className={`text-[14px] font-medium ${colors ? colors.titleText : "text-zinc-400"}`}>
              {isUntagged ? "Untagged" : themeName}
             </span>
             <span className={`text-[10px] font-mono ${colors ? `${colors.badgeBg} border ${colors.badgeBorder} ${colors.text}` : "bg-zinc-800 border border-zinc-700/50 text-zinc-500"} px-1.5 py-0.5 rounded-[2px]`}>
              {items.length}
             </span>
            </div>

            {/* Approval rows */}
            {items.map((approval, i) => {
             const pmNames = approval.proxy_metric_names || [];
             return (
              <div
               key={approval.id || approval._file || i}
               className={`flex flex-col gap-2.5 px-[20px] py-4 hover:bg-zinc-800/40 transition-colors cursor-pointer ${i < items.length - 1 ? "border-b border-border/30" : ""}`}
               onClick={() => navigate("approval-detail", approval.id || approval._file)}
              >
               <div className="flex items-center gap-4">
                {(() => { const t = resolveType(approval); return (
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-normal border shrink-0 ${typeStyle(t.key)}`}>
                 {t.label}
                </span>); })()}
                {approval.mode && (() => {
                 const isAutoloop = approval.mode === "autoloop";
                 return (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border shrink-0 ${isAutoloop ? "border-orange-500/20 bg-orange-500/10 text-orange-400" : "border-blue-500/20 bg-blue-500/10 text-blue-400"}`}>
                   {isAutoloop ? "autoloop" : "one-shot"}
                  </span>
                 );
                })()}
                <span className="text-[15px] font-medium text-zinc-200 flex-1 truncate">
                 {approval.what || approval.title}
                </span>
                <span className="text-[12px] font-mono text-zinc-500 shrink-0">
                 {timeAgo(approval.created)}
                </span>
               </div>
               {/* Proxy metric pills — theme is already shown in the sub-header */}
               {pmNames.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                 {pmNames.map((pm, j) => (
                  <div key={j} className="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-zinc-800/40 border border-zinc-700/30">
                   <div className="w-3.5 h-3.5 rounded bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center text-[9px] font-mono text-zinc-500 flex-shrink-0">
                    {String.fromCharCode(97 + j)}
                   </div>
                   <span className="text-[12px] text-zinc-400">{pm}</span>
                  </div>
                 ))}
                </div>
               )}
               <div className="flex items-center justify-between">
                <span className="text-[15px] text-zinc-400">
                 Requested by {approval.requester || "agent"}
                </span>
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
             );
            })}
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
