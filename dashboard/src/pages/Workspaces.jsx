/**
 * Workspaces Page — table view of execution workspaces (sub-agent runs).
 */

import { useState, useEffect } from"react";
import { Terminal } from"lucide-react";
import { getWorkspaces, getProjects, getAgents } from"../api.js";
import { WorkspaceRow } from"../components/WorkspaceRow.jsx";
import { EmptyState } from"../components/EmptyState.jsx";
import { Skeleton } from"../components/ui/Skeleton.jsx";

export default function Workspaces() {
 const [workspaces, setWorkspaces] = useState([]);
 const [projects, setProjects] = useState([]);
 const [agents, setAgents] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);

 // Filters
 const [filterProject, setFilterProject] = useState("");
 const [filterAgent, setFilterAgent] = useState("");
 const [filterStatus, setFilterStatus] = useState("");

 const load = () => {
  setLoading(true);
  const params = {};
  if (filterProject) params.project = filterProject;
  if (filterAgent) params.agent = filterAgent;
  if (filterStatus) params.status = filterStatus;

  Promise.all([
   getWorkspaces(params),
   getProjects().catch(() => []),
   getAgents().catch(() => []),
  ])
   .then(([ws, p, a]) => {
    setWorkspaces(ws);
    setProjects(p);
    setAgents(a);
   })
   .catch((e) => setError(e.message))
   .finally(() => setLoading(false));
 };

 useEffect(() => { load(); }, [filterProject, filterAgent, filterStatus]);

 // Compute summary
 const runningCount = workspaces.filter((w) => w.status ==="running").length;
 const completedCount = workspaces.filter((w) => w.status ==="completed" || w.status ==="succeeded").length;
 const errorCount = workspaces.filter((w) => w.status ==="error" || w.status ==="failed").length;

 if (loading && workspaces.length === 0) {
  return (
   <div className="max-w-[1400px] mx-auto space-y-6">
    <div className="h-12" />
    <Skeleton className="h-8 w-32" />
    <Skeleton className="h-64 w-full" />
   </div>
  );
 }

 return (
  <div className="max-w-[1400px] mx-auto space-y-6">
   {/* Breadcrumb bar */}
   <div className="h-12 flex items-center justify-between">
    <h1 className="text-base font-semibold uppercase tracking-wider">Workspaces</h1>
    <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
     <span>{workspaces.length} runs</span>
     {runningCount > 0 && <span className="text-cyan-400">{runningCount} running</span>}
     <span className="text-green-400">{completedCount} completed</span>
     {errorCount > 0 && <span className="text-red-400">{errorCount} errors</span>}
    </div>
   </div>

   {error && (
    <div className="text-[14px] text-destructive px-3 py-2 border border-destructive/30 bg-destructive/10">
     {error}
    </div>
   )}

   {/* Filters */}
   <div className="flex items-center gap-3 flex-wrap">
    <select
     className="bg-transparent border border-border px-2 py-1.5 text-[12px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-shadow"
     value={filterProject}
     onChange={(e) => setFilterProject(e.target.value)}
    >
     <option value="">All Projects</option>
     {projects.map((p) => (
      <option key={p.id || p.slug} value={p.id || p.slug}>
       {p.title || p.id}
      </option>
     ))}
    </select>

    <select
     className="bg-transparent border border-border px-2 py-1.5 text-[12px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-shadow"
     value={filterAgent}
     onChange={(e) => setFilterAgent(e.target.value)}
    >
     <option value="">All Agents</option>
     {agents.map((a) => (
      <option key={a.id} value={a.name?.toLowerCase() || a.id}>
       {a.name || a.id}
      </option>
     ))}
    </select>

    <select
     className="bg-transparent border border-border px-2 py-1.5 text-[12px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-shadow"
     value={filterStatus}
     onChange={(e) => setFilterStatus(e.target.value)}
    >
     <option value="">All Statuses</option>
     <option value="running">Running</option>
     <option value="completed">Completed</option>
     <option value="succeeded">Succeeded</option>
     <option value="failed">Failed</option>
     <option value="error">Error</option>
    </select>

    {(filterProject || filterAgent || filterStatus) && (
     <button
      onClick={() => { setFilterProject(""); setFilterAgent(""); setFilterStatus(""); }}
      className="text-[12px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
     >
      Clear all
     </button>
    )}
   </div>

   {/* Table */}
   {workspaces.length === 0 ? (
    <EmptyState
     icon={Terminal}
     text="No execution workspaces found"
     sub="Sub-agent runs will appear here once agents start spawning workspaces"
    />
   ) : (
    <div className="border border-border">
     {/* Header */}
     <div className="flex items-center gap-3 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/20">
      <span className="w-3.5 shrink-0" />
      <span className="w-20 shrink-0">Agent</span>
      <span className="w-28 shrink-0">Project</span>
      <span className="w-16 shrink-0">Issue</span>
      <span className="w-16 shrink-0">Type</span>
      <span className="w-20 shrink-0 hidden lg:block">Model</span>
      <span className="w-16 shrink-0">Status</span>
      <span className="w-16 shrink-0 text-right hidden sm:block">Duration</span>
      <span className="w-16 shrink-0 text-right hidden md:block">Started</span>
     </div>

     {/* Rows */}
     {workspaces.map((ws, i) => (
      <WorkspaceRow key={ws.id || i} workspace={ws} />
     ))}
    </div>
   )}
  </div>
 );
}
