/**
 * Issues — issue list + kanban board for a project.
 * Adapted from Paperclip's IssuesList + KanbanBoard layout.
 */
import { useState, useEffect, useMemo } from"react";
import { getIssues, updateIssue } from"../api.js";
import {
 List,
 LayoutGrid,
 Plus,
 Search,
 ArrowRight,
 CircleDot,
} from"lucide-react";
import { formatTimeAgo } from"../utils/formatDate.js";
import { Skeleton } from"../components/ui/Skeleton.jsx";
import { StatusBadge } from"../components/StatusBadge.jsx";
import { EmptyState } from"../components/EmptyState.jsx";
import { EntityRow } from"../components/EntityRow.jsx";
import { PriorityIcon, PriorityDot } from"../components/PriorityIcon.jsx";
import { StatusCircle, ALL_STATUSES } from"../components/StatusSelect.jsx";
import { ALL_PRIORITIES } from"../components/PriorityIcon.jsx";
import { AgentInitial, AGENTS } from"../components/AssigneeSelect.jsx";
import { KanbanBoard } from"../components/KanbanBoard.jsx";
import { CreateIssue } from"../components/CreateIssue.jsx";

function timeAgo(iso) {
 if (!iso) return"";
 return formatTimeAgo(iso);
}

export default function Issues({ projectSlug, navigate, themes = [] }) {
 const [issues, setIssues] = useState([]);
 const [loading, setLoading] = useState(true);
 const [view, setView] = useState("list"); //"list" or"board"
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

 // Proposed issues live in Approvals — only show active issues here
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
  if (filterStatus) {
   result = result.filter((i) => i.status === filterStatus);
  }
  if (filterPriority) {
   result = result.filter((i) => i.priority === filterPriority);
  }
  if (filterAssignee) {
   result = result.filter((i) => i.assignee === filterAssignee);
  }
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
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-8 w-full" />
    <Skeleton className="h-8 w-full" />
    <Skeleton className="h-8 w-full" />
   </div>
  );
 }

 return (
  <div className="space-y-4">
   {/* Toolbar */}
   <div className="flex items-center gap-2 flex-wrap">
    {/* Search */}
    <div className="flex items-center gap-1.5 flex-1 min-w-[200px] rounded border border-border bg-transparent px-2 py-1.5">
     <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
     <input
      type="text"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder="Search issues..."
      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
     />
    </div>

    {/* Filters */}
    <select
     value={filterStatus}
     onChange={(e) => setFilterStatus(e.target.value)}
     className="rounded border border-border bg-transparent px-2 py-1.5 text-xs outline-none"
    >
     <option value="">All statuses</option>
     {ALL_STATUSES.filter((s) => s !=="proposed").map((s) => (
      <option key={s} value={s}>
       {s.replace(/_/g,"").replace(/\b\w/g, (c) => c.toUpperCase())}
      </option>
     ))}
    </select>

    <select
     value={filterPriority}
     onChange={(e) => setFilterPriority(e.target.value)}
     className="rounded border border-border bg-transparent px-2 py-1.5 text-xs outline-none"
    >
     <option value="">All priorities</option>
     {ALL_PRIORITIES.map((p) => (
      <option key={p} value={p}>
       {p.charAt(0).toUpperCase() + p.slice(1)}
      </option>
     ))}
    </select>

    <select
     value={filterAssignee}
     onChange={(e) => setFilterAssignee(e.target.value)}
     className="rounded border border-border bg-transparent px-2 py-1.5 text-xs outline-none"
    >
     <option value="">All assignees</option>
     {AGENTS.map((a) => (
      <option key={a.id} value={a.id}>
       {a.name}
      </option>
     ))}
    </select>

    {/* View toggle */}
    <div className="flex items-center border border-border rounded">
     <button
      onClick={() => setView("list")}
      className={`p-1.5 transition-colors ${view ==="list" ?"bg-accent text-foreground" :"text-muted-foreground hover:text-foreground"}`}
      title="List view"
     >
      <List className="h-4 w-4" />
     </button>
     <button
      onClick={() => setView("board")}
      className={`p-1.5 transition-colors ${view ==="board" ?"bg-accent text-foreground" :"text-muted-foreground hover:text-foreground"}`}
      title="Board view"
     >
      <LayoutGrid className="h-4 w-4" />
     </button>
    </div>

    {/* New issue button */}
    <button
     onClick={() => setShowCreate(!showCreate)}
     className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
    >
     <Plus className="h-3.5 w-3.5" />
     New Issue
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
     action={issues.length === 0 ?"New Issue" : undefined}
     onAction={issues.length === 0 ? () => setShowCreate(true) : undefined}
    />
   ) : view ==="board" ? (
    <KanbanBoard
     issues={filteredIssues}
     onIssueClick={handleIssueClick}
    />
   ) : (
    /* List view */
    <div className="border border-border divide-y divide-border">
     {filteredIssues.map((issue) => (
      <EntityRow
       key={issue.id}
       onClick={() => handleIssueClick(issue)}
       leading={
        <div className="flex items-center gap-2">
         <PriorityDot priority={issue.priority} />
         <StatusCircle status={issue.status} />
        </div>
       }
       identifier={issue.id}
       title={issue.title}
       trailing={
        <>
         <StatusBadge status={issue.status} />
         {issue.assignee && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
           <AgentInitial name={issue.assignee} />
           <span className="hidden sm:inline capitalize">{issue.assignee}</span>
          </span>
         )}
         <span className="text-xs text-muted-foreground tabular-nums shrink-0 hidden sm:inline">
          {timeAgo(issue.updated)}
         </span>
         <ArrowRight size={14} className="text-muted-foreground/50 shrink-0" />
        </>
       }
      />
     ))}
    </div>
   )}
  </div>
 );
}
