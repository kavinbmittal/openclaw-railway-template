/**
 * Issues — issue list + kanban board for a project.
 * UI ported from Aura HTML reference.
 */
import { useState, useEffect, useMemo } from"react";
import { getIssues, updateIssue } from"../api.js";
import { List, LayoutGrid, Plus, Search, CircleDot } from"lucide-react";
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

export default function Issues({ projectSlug, navigate, themes = [] }) {
 const [issues, setIssues] = useState([]);
 const [loading, setLoading] = useState(true);
 const [view, setView] = useState("list");
 const [showCreate, setShowCreate] = useState(false);
 const [searchQuery, setSearchQuery] = useState("");
 const [filterStatus, setFilterStatus] = useState("");
 const [filterPriority, setFilterPriority] = useState("");
 const [filterAssignee, setFilterAssignee] = useState("");

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
   {/* Filters & Actions — Aura: flex justify-between, rounded-[6px] buttons */}
   <div className="flex justify-between items-center">
    <div className="flex gap-2">
     <select
      value={filterStatus}
      onChange={(e) => setFilterStatus(e.target.value)}
      className="flex items-center gap-2 bg-card border border-border hover:border-muted-foreground/30 text-foreground text-[13px] rounded-[6px] px-3 py-1.5 transition-colors focus:outline-none focus:ring-[3px] focus:ring-ring/50"
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
      className="flex items-center gap-2 bg-card border border-border hover:border-muted-foreground/30 text-foreground text-[13px] rounded-[6px] px-3 py-1.5 transition-colors focus:outline-none focus:ring-[3px] focus:ring-ring/50"
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
      className="flex items-center gap-2 bg-card border border-border hover:border-muted-foreground/30 text-foreground text-[13px] rounded-[6px] px-3 py-1.5 transition-colors focus:outline-none focus:ring-[3px] focus:ring-ring/50"
     >
      <option value="">Assignee</option>
      {AGENTS.map((a) => (
       <option key={a.id} value={a.id}>{a.name}</option>
      ))}
     </select>
    </div>

    <button
     onClick={() => setShowCreate(!showCreate)}
     className="text-[13px] font-medium rounded-[6px] border border-border bg-secondary hover:bg-accent px-3 py-1.5 text-foreground transition-colors focus:outline-none focus:ring-[3px] focus:ring-ring/50"
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
    /* List view — Aura: card with issue rows */
    <div className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
     {filteredIssues.map((issue, i) => {
      const isDone = issue.status ==="done" || issue.status ==="cancelled";
      return (
       <div
        key={issue.id}
        onClick={() => handleIssueClick(issue)}
        className={`flex items-center gap-4 px-5 py-3 hover:bg-accent/40 transition-colors cursor-pointer ${
         i < filteredIssues.length - 1 ?"border-b border-border/50" :""
        }`}
        tabIndex="0"
       >
        <PriorityDot priority={issue.priority} />
        <StatusCircle status={issue.status} />
        <span className="text-[12px] font-mono text-muted-foreground shrink-0 whitespace-nowrap">{issue.id}</span>
        <span className={`text-[14px] flex-1 truncate ${isDone ?"text-muted-foreground line-through decoration-muted-foreground/40" :"text-foreground"}`}>
         {issue.title}
        </span>
        <StatusBadge status={issue.status} />
        {issue.assignee && (
         <span className="text-[12px] text-muted-foreground w-24 truncate hidden sm:block capitalize">
          {issue.assignee}
         </span>
        )}
        <span className="text-[12px] text-muted-foreground w-20 text-right font-mono shrink-0">
         {timeAgo(issue.updated)}
        </span>
       </div>
      );
     })}
    </div>
   )}
  </div>
 );
}
