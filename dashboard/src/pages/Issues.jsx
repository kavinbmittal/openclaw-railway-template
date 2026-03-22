/**
 * Issues — issue list + kanban board for a project.
 * UI ported from Aura HTML reference.
 * List view groups issues by theme with collapsible sections.
 */
import { useState, useEffect, useMemo } from"react";
import { getIssues, updateIssue } from"../api.js";
import { List, LayoutGrid, Plus, Search, CircleDot, ChevronDown } from"lucide-react";
import { formatTimeAgo } from"../utils/formatDate.js";
import { Skeleton } from"../components/ui/Skeleton.jsx";
import { StatusBadge } from"../components/StatusBadge.jsx";
import { EmptyState } from"../components/EmptyState.jsx";
import { PriorityDot } from"../components/PriorityIcon.jsx";
import { StatusCircle, ALL_STATUSES } from"../components/StatusSelect.jsx";
import { ALL_PRIORITIES } from"../components/PriorityIcon.jsx";
import { AGENTS } from"../components/AssigneeSelect.jsx";
import { KanbanBoard } from"../components/KanbanBoard.jsx";
import { CreateIssue } from"../components/CreateIssue.jsx";

function timeAgo(iso) {
 if (!iso) return"";
 return formatTimeAgo(iso);
}

// Theme color palette — cycle through based on theme index
// Each entry uses the exact Aura HTML hover class (full string) so Tailwind can detect it.
const THEME_COLORS = [
 { headerClass: "bg-indigo-500/[0.02] hover:bg-indigo-500/[0.05]", badgeBg: "bg-indigo-500/10", badgeBorder: "border-indigo-500/20", text: "text-indigo-400", titleText: "text-indigo-100", countBg: "bg-indigo-500/10", countBorder: "border-indigo-500/20", chevron: "text-indigo-400/50" },
 { headerClass: "bg-emerald-500/[0.02] hover:bg-emerald-500/[0.05]", badgeBg: "bg-emerald-500/10", badgeBorder: "border-emerald-500/20", text: "text-emerald-400", titleText: "text-emerald-100", countBg: "bg-emerald-500/10", countBorder: "border-emerald-500/20", chevron: "text-emerald-400/50" },
 { headerClass: "bg-amber-500/[0.02] hover:bg-amber-500/[0.05]", badgeBg: "bg-amber-500/10", badgeBorder: "border-amber-500/20", text: "text-amber-400", titleText: "text-amber-100", countBg: "bg-amber-500/10", countBorder: "border-amber-500/20", chevron: "text-amber-400/50" },
 { headerClass: "bg-cyan-500/[0.02] hover:bg-cyan-500/[0.05]", badgeBg: "bg-cyan-500/10", badgeBorder: "border-cyan-500/20", text: "text-cyan-400", titleText: "text-cyan-100", countBg: "bg-cyan-500/10", countBorder: "border-cyan-500/20", chevron: "text-cyan-400/50" },
 { headerClass: "bg-rose-500/[0.02] hover:bg-rose-500/[0.05]", badgeBg: "bg-rose-500/10", badgeBorder: "border-rose-500/20", text: "text-rose-400", titleText: "text-rose-100", countBg: "bg-rose-500/10", countBorder: "border-rose-500/20", chevron: "text-rose-400/50" },
];

/** Single issue row inside a theme group */
function IssueRow({ issue, onClick }) {
 const isDone = issue.status === "done" || issue.status === "cancelled";
 return (
  <div
   onClick={onClick}
   className="flex items-center gap-4 px-5 py-3 border-t border-border/50 hover:bg-zinc-800/30 cursor-pointer transition-colors"
  >
   <PriorityDot priority={issue.priority} />
   <StatusCircle status={issue.status} />
   <span className="text-[12px] font-mono text-zinc-500 shrink-0 whitespace-nowrap">{issue.id}</span>
   <span className={`text-[15px] flex-1 truncate ${isDone ? "text-zinc-500 line-through decoration-zinc-600" : "text-zinc-200"}`}>
    {issue.title}
   </span>
   <StatusBadge status={issue.status} />
   {issue.assignee && (
    <span className="text-[12px] text-zinc-400 w-24 truncate capitalize hidden sm:block">{issue.assignee}</span>
   )}
   <span className="text-[12px] font-mono text-zinc-500 w-20 text-right shrink-0">{timeAgo(issue.updated)}</span>
  </div>
 );
}

export default function Issues({ projectSlug, navigate, themes = [] }) {
 const [issues, setIssues] = useState([]);
 const [loading, setLoading] = useState(true);
 const [view, setView] = useState("list");
 const [showCreate, setShowCreate] = useState(false);
 const [searchQuery, setSearchQuery] = useState("");
 const [filterStatus, setFilterStatus] = useState("");
 const [filterPriority, setFilterPriority] = useState("");
 const [filterAssignee, setFilterAssignee] = useState("");
 const [expandedThemes, setExpandedThemes] = useState({});

 function toggleTheme(id) {
  setExpandedThemes(prev => ({ ...prev, [id]: prev[id] === false ? true : false }));
 }

 function loadIssues() {
  getIssues(projectSlug)
   .then(setIssues)
   .catch(() => {})
   .finally(() => setLoading(false));
 }

 useEffect(() => {
  loadIssues();
 }, [projectSlug]);

 const activeIssues = useMemo(() => issues.filter((i) => i.status !=="proposed"), [issues]);

 const filteredIssues = useMemo(() => {
  let result = activeIssues;
  if (searchQuery.trim()) {
   const q = searchQuery.toLowerCase();
   result = result.filter(
    (i) =>
     i.title.toLowerCase().includes(q) ||
     i.id.toLowerCase().includes(q)
   );
  }
  if (filterStatus) result = result.filter((i) => i.status === filterStatus);
  if (filterPriority) result = result.filter((i) => i.priority === filterPriority);
  if (filterAssignee) result = result.filter((i) => i.assignee === filterAssignee);
  return result;
 }, [activeIssues, searchQuery, filterStatus, filterPriority, filterAssignee]);

 // Approved themes sorted by order
 const sortedThemes = useMemo(() =>
  themes.filter(t => t.status === "approved").sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
  [themes]
 );

 // Issues that don't belong to any approved theme
 const unthemedIssues = useMemo(() =>
  filteredIssues.filter(i => !i.theme || !sortedThemes.find(t => t.id === i.theme)),
  [filteredIssues, sortedThemes]
 );

 async function handleStatusChange(issueId, newStatus) {
  try {
   await updateIssue(issueId, projectSlug, { status: newStatus });
   setIssues((prev) =>
    prev.map((i) => (i.id === issueId ? { ...i, status: newStatus, updated: new Date().toISOString() } : i))
   );
  } catch (err) {
   console.error("Failed to update status:", err);
  }
 }

 function handleIssueClick(issue) {
  navigate("issue-detail", { projectSlug, issueId: issue.id });
 }

 function handleCreated(issue) {
  setIssues((prev) => [issue, ...prev]);
  setShowCreate(false);
 }

 if (loading) {
  return (
   <div className="space-y-3">
    <Skeleton className="h-10 w-full rounded-[2px]" />
    <Skeleton className="h-8 w-full rounded-[2px]" />
    <Skeleton className="h-8 w-full rounded-[2px]" />
   </div>
  );
 }

 return (
  <div className="space-y-4">
   {/* Filters & Actions */}
   <div className="flex justify-between items-center">
    <div className="flex gap-2">
     <select
      value={filterStatus}
      onChange={(e) => setFilterStatus(e.target.value)}
      className="flex items-center gap-2 rounded-[6px] border border-border bg-card text-[15px] px-3 py-1.5 text-zinc-300 hover:border-zinc-700 transition-[color,box-shadow] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
     >
      <option value="">Status: All</option>
      {ALL_STATUSES.filter((s) => s !=="proposed").map((s) => (
       <option key={s} value={s}>
        {s.replace(/_/g," ").replace(/\b\w/g, (c) => c.toUpperCase())}
       </option>
      ))}
     </select>

     <select
      value={filterPriority}
      onChange={(e) => setFilterPriority(e.target.value)}
      className="flex items-center gap-2 rounded-[6px] border border-border bg-card text-[15px] px-3 py-1.5 text-zinc-300 hover:border-zinc-700 transition-[color,box-shadow] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
     >
      <option value="">Priority: All</option>
      {ALL_PRIORITIES.map((p) => (
       <option key={p} value={p}>
        {p.charAt(0).toUpperCase() + p.slice(1)}
       </option>
      ))}
     </select>

     <select
      value={filterAssignee}
      onChange={(e) => setFilterAssignee(e.target.value)}
      className="flex items-center gap-2 rounded-[6px] border border-border bg-card text-[15px] px-3 py-1.5 text-zinc-300 hover:border-zinc-700 transition-[color,box-shadow] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
     >
      <option value="">Assignee</option>
      {AGENTS.map((a) => (
       <option key={a.id} value={a.id}>{a.name}</option>
      ))}
     </select>
    </div>

    <button
     onClick={() => setShowCreate(!showCreate)}
     className="rounded-[6px] border border-border bg-card text-[15px] font-medium text-zinc-300 px-3 py-1.5 hover:bg-zinc-800 transition-[color,box-shadow] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
     Create Issue
    </button>
   </div>

   {/* Create issue form */}
   {showCreate && (
    <CreateIssue
     projectSlug={projectSlug}
     onCreated={handleCreated}
     onClose={() => setShowCreate(false)}
     themes={themes}
    />
   )}

   {/* Content */}
   {filteredIssues.length === 0 && !showCreate ? (
    <EmptyState
     icon={CircleDot}
     text="No issues found"
     sub={issues.length > 0 ?"Try adjusting your filters" :"Create your first issue to get started"}
    />
   ) : view ==="board" ? (
    <KanbanBoard issues={filteredIssues} onIssueClick={handleIssueClick} />
   ) : (
    /* List view — grouped by theme */
    <div className="space-y-4">
     {/* Theme groups */}
     {sortedThemes.map((theme, themeIdx) => {
      const themeIssues = filteredIssues.filter(i => i.theme === theme.id);
      const isExpanded = expandedThemes[theme.id] !== false; // default expanded
      const themeColors = THEME_COLORS[themeIdx % THEME_COLORS.length];

      return (
       <div key={theme.id} className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
        {/* Theme Header */}
        <div
         onClick={() => toggleTheme(theme.id)}
         className={`flex items-center gap-3 px-5 py-3 ${themeColors.headerClass} transition-colors cursor-pointer select-none`}
        >
         <div className={`w-6 h-6 rounded-full ${themeColors.badgeBg} border ${themeColors.badgeBorder} flex items-center justify-center text-[11px] font-mono font-medium ${themeColors.text} flex-shrink-0`}>
          {theme.order ?? themeIdx + 1}
         </div>
         <div className={`text-[15px] font-medium ${themeColors.titleText}`}>{theme.title}</div>
         <div className={`text-[11px] font-mono ${themeColors.countBg} border ${themeColors.countBorder} px-1.5 py-0.5 rounded-[2px] ${themeColors.text}`}>
          {themeIssues.length}
         </div>
         <ChevronDown size={14} className={`${themeColors.chevron} ml-auto transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`} />
        </div>

        {/* Theme Content */}
        {isExpanded && (
         <div className="border-t border-border/50">
          {/* Proxy Metrics */}
          {(theme.proxy_metrics || []).length > 0 && (
           <div className="ml-9 mb-2 mt-2 space-y-1.5">
            {(theme.proxy_metrics || []).sort((a, b) => (a.order ?? 999) - (b.order ?? 999)).map((pm, pmIdx) => (
             <div key={pm.id} className="flex items-center gap-2 text-[12px] text-zinc-400">
              <div className="w-4 h-4 rounded bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center text-[9px] font-mono text-zinc-500 flex-shrink-0">
               {String.fromCharCode(97 + pmIdx)}
              </div>
              <span>{pm.name}</span>
             </div>
            ))}
           </div>
          )}

          {/* Issue rows or empty state */}
          {themeIssues.length === 0 ? (
           <div className="text-center text-[15px] text-zinc-500 py-4 border-t border-border/50">
            No issues for this theme
           </div>
          ) : (
           <div>
            {themeIssues.map(issue => (
             <IssueRow key={issue.id} issue={issue} onClick={() => handleIssueClick(issue)} />
            ))}
           </div>
          )}
         </div>
        )}
       </div>
      );
     })}

     {/* Unthemed group */}
     {unthemedIssues.length > 0 && (
      <div className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
       <div
        onClick={() => toggleTheme("_unthemed")}
        className="flex items-center gap-3 px-5 py-3 bg-zinc-800/[0.2] hover:bg-zinc-800/[0.4] transition-colors cursor-pointer select-none"
       >
        <div className="w-6 h-6 rounded-full border border-dashed border-zinc-700 bg-zinc-800/30 flex items-center justify-center text-[11px] font-medium text-zinc-400 flex-shrink-0">&mdash;</div>
        <div className="text-[15px] font-medium text-zinc-200">Unthemed</div>
        <div className="text-[11px] font-mono bg-zinc-800/50 border border-zinc-700/50 px-1.5 py-0.5 rounded-[2px] text-zinc-400">{unthemedIssues.length}</div>
        <ChevronDown size={14} className={`text-zinc-500 ml-auto transition-transform duration-200 ${expandedThemes["_unthemed"] === false ? "-rotate-90" : ""}`} />
       </div>
       {expandedThemes["_unthemed"] !== false && (
        <div className="border-t border-border/50">
         {unthemedIssues.map(issue => (
          <IssueRow key={issue.id} issue={issue} onClick={() => handleIssueClick(issue)} />
         ))}
        </div>
       )}
      </div>
     )}
    </div>
   )}
  </div>
 );
}
