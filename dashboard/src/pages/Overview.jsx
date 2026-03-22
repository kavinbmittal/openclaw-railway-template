import { useState, useEffect } from"react";
import { getProjects, getInbox, getIssues, getProjectsSummary, getAgents } from "../api.js";
import { FolderKanban, User, DollarSign, AlertTriangle, CheckCircle, ArrowUpRight, CircleDot, Milestone } from "lucide-react";
import { formatTimeAgo } from"../utils/formatDate.js";
import { Skeleton } from"../components/ui/Skeleton.jsx";
import { MetricCard } from"../components/MetricCard.jsx";
import { StatusBadge, STATUS_DOT } from"../components/StatusBadge.jsx";
import { EmptyState } from"../components/EmptyState.jsx";
import { EntityRow } from"../components/EntityRow.jsx";
import { PriorityDot } from"../components/PriorityIcon.jsx";
import { StatusCircle } from"../components/StatusSelect.jsx";
import { QuotaBar } from"../components/QuotaBar.jsx";

function timeAgo(iso) {
 if (!iso) return"";
 return formatTimeAgo(iso);
}

function parseBudgetNumber(budgetStr) {
 if (!budgetStr) return 0;
 const m = budgetStr.match(/\$(\d+)/);
 return m ? parseInt(m[1]) : 0;
}

function truncate(str, max) {
 if (!str) return"";
 const firstLine = str.split("\n")[0];
 if (firstLine.length <= max) return firstLine;
 return firstLine.slice(0, max) +"...";
}

export default function Overview({ navigate }) {
 const [projects, setProjects] = useState([]);
 const [projectSummaries, setProjectSummaries] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [inboxCount, setInboxCount] = useState(null);
 const [recentIssues, setRecentIssues] = useState([]);
 const [agentCount, setAgentCount] = useState(null);

 useEffect(() => {
  getAgents().then((a) => setAgentCount(a?.length ?? null)).catch(() => {});
  Promise.all([
   getProjects(),
   getInbox().catch(() => null),
   getProjectsSummary().catch(() => []),
  ])
   .then(async ([projs, inbox, summaries]) => {
    setProjects(projs);
    setProjectSummaries(summaries);
    if (inbox?.counts) {
     // Only count actionable items (approvals + budget + stale tasks), not standups
     const c = inbox.counts;
     setInboxCount((c.approvals || 0) + (c.budget || 0) + (c.tasks || 0));
    }
    // Load recent issues across all projects
    try {
     const allIssues = [];
     await Promise.all(
      projs.map(async (p) => {
       try {
        const issues = await getIssues(p.id);
        issues.forEach((i) => allIssues.push(i));
       } catch { /* skip */ }
      })
     );
     allIssues.sort((a, b) => (b.updated ||"").localeCompare(a.updated ||""));
     setRecentIssues(allIssues.slice(0, 5));
    } catch { /* skip */ }
   })
   .catch((e) => setError(e.message))
   .finally(() => setLoading(false));
 }, []);

 if (loading) {
  return (
   <div className="space-y-6">
    <div className="h-12" />
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-1">
     {[1, 2, 3, 4].map((i) => (
      <div key={i} className="border border-border p-4">
       <Skeleton className="h-4 w-20 mb-3" />
       <Skeleton className="h-8 w-16" />
      </div>
     ))}
    </div>
   </div>
  );
 }

 if (error) {
  return (
   <div className="flex items-center justify-center h-64">
    <p className="text-sm text-destructive">Error: {error}</p>
   </div>
  );
 }

 const activeCount = projects.filter((p) => p.status ==="active").length;
 const totalBudget = projects
  .map((p) => parseBudgetNumber(p.budget))
  .reduce((a, b) => a + b, 0);

 // Use summaries if available, else fall back to basic projects list
 const displayProjects = projectSummaries.length > 0 ? projectSummaries : projects;

 return (
  <div className="space-y-6">
   {/* Breadcrumb bar */}
   <div className="h-12 flex items-center">
    <h1 className="text-base font-semibold uppercase tracking-wider">Dashboard</h1>
   </div>

   {/* Needs Attention banner */}
   {inboxCount !== null && (
    <div
     onClick={() => navigate("inbox")}
     className={`flex items-center gap-3 px-4 py-3 border cursor-pointer transition-colors ${
      inboxCount > 0
       ?"border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15"
       :"border-green-500/30 bg-green-500/10 hover:bg-green-500/15"
     }`}
    >
     {inboxCount > 0 ? (
      <>
       <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
       <span className="text-sm font-medium text-amber-300 flex-1">
        {inboxCount} {inboxCount === 1 ?"item needs" :"items need"} your attention
       </span>
       <ArrowUpRight className="h-4 w-4 text-amber-400/60 shrink-0" />
      </>
     ) : (
      <>
       <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
       <span className="text-sm font-medium text-green-300 flex-1">
        All clear
       </span>
      </>
     )}
    </div>
   )}

   {/* Metric cards */}
   <div className="grid grid-cols-2 xl:grid-cols-4 gap-1 sm:gap-2">
    <MetricCard label="Projects" value={projects.length} />
    <MetricCard label="Active" value={activeCount} />
    <MetricCard label="Weekly Budget" value={`$${totalBudget}`} mono />
    <MetricCard label="Agents" value={agentCount ?? "—"} />
   </div>

   {/* Project Progress section */}
   <div>
    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
     Project Progress
    </h3>

    {displayProjects.length === 0 ? (
     <EmptyState
      icon={FolderKanban}
      text="No projects yet"
      sub="Create a project directory in shared/projects/"
     />
    ) : (
     <div className="border border-border overflow-x-auto">
      <table className="w-full text-sm">
       <thead>
        <tr className="border-b border-border text-left">
         <th className="px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/60 font-medium">Project</th>
         <th className="px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/60 font-medium hidden lg:table-cell">Mission / Goal</th>
         <th className="px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/60 font-medium hidden sm:table-cell">Lead</th>
         <th className="px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/60 font-medium hidden md:table-cell">Milestone</th>
         <th className="px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/60 font-medium">Issues</th>
         <th className="px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/60 font-medium hidden sm:table-cell min-w-[140px]">Budget</th>
        </tr>
       </thead>
       <tbody className="divide-y divide-border">
        {displayProjects.map((project) => {
         const slug = project.id || project.slug;
         const budgetNum = parseBudgetNumber(project.budget);
         const spend = project.totalSpend || 0;
         const utilizationPct = budgetNum > 0 ? Math.round((spend / budgetNum) * 100) : 0;

         return (
          <tr
           key={slug}
           onClick={() => navigate("project", slug)}
           className="cursor-pointer hover:bg-accent/50 transition-colors"
          >
           {/* Project name + status */}
           <td className="px-4 py-3">
            <div className="flex items-center gap-2">
             <span
              className={`w-2 h-2 rounded-full shrink-0 ${
               STATUS_DOT[project.status] || STATUS_DOT.unknown
              }`}
             />
             <span className="font-medium text-foreground truncate max-w-[200px]">
              {project.title || slug}
             </span>
            </div>
           </td>

           {/* Mission / Goal */}
           <td className="px-4 py-3 hidden lg:table-cell">
            <span className="text-xs text-muted-foreground truncate block max-w-[240px]">
             {truncate(project.mission ||"", 60) ||"--"}
            </span>
           </td>

           {/* Lead */}
           <td className="px-4 py-3 hidden sm:table-cell">
            {project.lead && project.lead !=="unassigned" ? (
             <span
              className="text-xs text-muted-foreground capitalize cursor-pointer hover:text-foreground transition-colors"
              onClick={(e) => {
               e.stopPropagation();
               const name = project.lead.toLowerCase();
               const workspaceId = name ==="sam" ?"workspace" : `workspace-${name}`;
               navigate("agent-detail", workspaceId);
              }}
             >
              {project.lead}
             </span>
            ) : (
             <span className="text-xs text-muted-foreground">--</span>
            )}
           </td>

           {/* Milestone */}
           <td className="px-4 py-3 hidden md:table-cell">
            <span className="text-xs text-muted-foreground truncate block max-w-[200px]">
             {project.currentMilestone
              ? truncate(project.currentMilestone, 40)
              : <span className="text-muted-foreground/40 italic">No milestones yet</span>}
            </span>
           </td>

           {/* Issues */}
           <td className="px-4 py-3">
            <span className="text-xs font-mono tabular-nums text-muted-foreground">
             {project.issuesDone != null
              ? `${project.issuesDone}/${project.issuesTotal}`
              :"--"}
            </span>
           </td>

           {/* Budget */}
           <td className="px-4 py-3 hidden sm:table-cell">
            {budgetNum > 0 ? (
             <div className="min-w-[120px]">
              <QuotaBar
               label=""
               percentUsed={utilizationPct}
               leftLabel={`$${spend.toFixed(0)}/$${budgetNum}`}
               rightLabel={`${utilizationPct}%`}
              />
             </div>
            ) : (
             <span className="text-xs text-muted-foreground/40">No budget</span>
            )}
           </td>
          </tr>
         );
        })}
       </tbody>
      </table>
     </div>
    )}
   </div>

   {/* Recent Issues section */}
   {recentIssues.length > 0 && (
    <div>
     <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
      Recent Issues
     </h3>
     <div className="border border-border divide-y divide-border">
      {recentIssues.map((issue) => (
       <EntityRow
        key={issue.id}
        onClick={() => navigate("issue-detail", { projectSlug: issue.project, issueId: issue.id })}
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
           <span className="text-xs text-muted-foreground shrink-0 capitalize">
            {issue.assignee}
           </span>
          )}
          <span className="text-xs text-muted-foreground tabular-nums shrink-0 hidden sm:inline">
           {timeAgo(issue.updated)}
          </span>
         </>
        }
       />
      ))}
     </div>
    </div>
   )}
  </div>
 );
}
