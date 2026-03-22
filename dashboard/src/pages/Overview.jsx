import { useState, useEffect } from"react";
import { getProjects, getInbox, getIssues, getProjectsSummary, getAgents } from "../api.js";
import { FolderKanban, User, DollarSign, AlertTriangle, CheckCircle, ArrowUpRight, CircleDot, Milestone, TrendingUp } from "lucide-react";
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
   <div className="max-w-[1400px] mx-auto space-y-6">
    <div className="h-10" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
     {[1, 2, 3, 4].map((i) => (
      <div key={i} className="bg-card border border-border rounded-[2px] shadow-sm p-[20px]">
       <Skeleton className="h-8 w-16 mb-2" />
       <Skeleton className="h-3 w-20" />
      </div>
     ))}
    </div>
   </div>
  );
 }

 if (error) {
  return (
   <div className="flex items-center justify-center h-64">
    <p className="text-[14px] text-destructive">Error: {error}</p>
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
  <div className="max-w-[1400px] mx-auto space-y-6">
   {/* Header */}
   <div className="flex items-center justify-between">
    <h1 className="text-[16px] font-semibold uppercase tracking-[0.2em] text-foreground">DASHBOARD</h1>
   </div>

   {/* Needs Attention banner */}
   {inboxCount !== null && (
    <div
     onClick={() => navigate("inbox")}
     className={`flex items-center gap-3 px-[20px] py-3 rounded-[2px] border shadow-sm cursor-pointer transition-colors ${
      inboxCount > 0
       ?"border-amber-500/20 bg-amber-500/5"
       :"border-emerald-500/20 bg-emerald-500/5"
     }`}
    >
     {inboxCount > 0 ? (
      <>
       <AlertTriangle className="text-amber-500 shrink-0" size={18} />
       <span className="text-[14px] text-amber-200/80 flex-1">
        {inboxCount} {inboxCount === 1 ?"item needs" :"items need"} your attention
       </span>
      </>
     ) : (
      <>
       <CheckCircle className="text-emerald-500 shrink-0" size={18} />
       <span className="text-[14px] text-emerald-200/80 flex-1">
        System stable. All clear — no pending approvals or alerts.
       </span>
      </>
     )}
    </div>
   )}

   {/* Metric cards */}
   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
    <MetricCard label="Projects" value={projects.length} />
    <MetricCard label="Active" value={activeCount} />
    <MetricCard label="Weekly Budget" value={`$${totalBudget}`} mono />
    <MetricCard label="Agents" value={agentCount ?? "—"} />
   </div>

   {/* Project Progress section */}
   <div className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
    <div className="flex items-center gap-3 px-5 py-3 bg-indigo-500/[0.02] transition-colors">
     <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
      <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
     </div>
     <div className="text-[15px] font-medium text-indigo-100">Project Progress</div>
    </div>

    {displayProjects.length === 0 ? (
     <div className="p-[20px]">
      <EmptyState
       icon={FolderKanban}
       text="No projects yet"
       sub="Create a project directory in shared/projects/"
      />
     </div>
    ) : (
     <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse whitespace-nowrap">
       <thead>
        <tr>
         <th className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground pb-3 px-[20px] pt-4 border-b border-border font-normal w-[25%]">Project</th>
         <th className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground pb-3 px-[20px] pt-4 border-b border-border font-normal w-[20%] hidden lg:table-cell">Mission / Goal</th>
         <th className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground pb-3 px-[20px] pt-4 border-b border-border font-normal w-[15%] hidden sm:table-cell">Lead</th>
         <th className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground pb-3 px-[20px] pt-4 border-b border-border font-normal w-[15%] hidden md:table-cell">Milestone</th>
         <th className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground pb-3 px-[20px] pt-4 border-b border-border font-normal w-[10%]">Issues</th>
         <th className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground pb-3 px-[20px] pt-4 border-b border-border font-normal w-[15%] hidden sm:table-cell">Budget</th>
        </tr>
       </thead>
       <tbody>
        {displayProjects.map((project) => {
         const slug = project.id || project.slug;
         const budgetNum = parseBudgetNumber(project.budget);
         const spend = project.totalSpend || 0;
         const utilizationPct = budgetNum > 0 ? Math.round((spend / budgetNum) * 100) : 0;

         return (
          <tr
           key={slug}
           onClick={() => navigate("project", slug)}
           className="border-b border-border/50 hover:bg-accent/40 transition-colors cursor-pointer"
           tabIndex="0"
          >
           {/* Project name + status */}
           <td className="px-[20px] py-3.5">
            <div className="flex items-center gap-2.5">
             <span
              className={`w-2 h-2 rounded-full shrink-0 ${
               STATUS_DOT[project.status] || STATUS_DOT.unknown
              }`}
             />
             <span className="text-[14px] font-medium text-foreground truncate max-w-[200px]">
              {project.title || slug}
             </span>
            </div>
           </td>

           {/* Mission / Goal */}
           <td className="px-[20px] py-3.5 hidden lg:table-cell text-[14px] text-muted-foreground">
            {truncate(project.mission ||"", 60) ||"--"}
           </td>

           {/* Lead */}
           <td className="px-[20px] py-3.5 hidden sm:table-cell">
            {project.lead && project.lead !=="unassigned" ? (
             <span
              className="text-[15px] text-muted-foreground capitalize cursor-pointer hover:text-foreground transition-colors"
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
             <span className="text-[15px] text-muted-foreground">--</span>
            )}
           </td>

           {/* Milestone */}
           <td className="px-[20px] py-3.5 hidden md:table-cell text-[15px] text-muted-foreground">
            {project.currentMilestone
             ? truncate(project.currentMilestone, 40)
             : <span className="text-muted-foreground/40 italic">No milestones yet</span>}
           </td>

           {/* Issues */}
           <td className="px-[20px] py-3.5">
            <span className="text-[12px] font-mono text-muted-foreground">
             {project.issuesDone != null
              ? `${project.issuesDone}/${project.issuesTotal}`
              :"--"}
            </span>
           </td>

           {/* Budget */}
           <td className="px-[20px] py-3.5 hidden sm:table-cell">
            {budgetNum > 0 ? (
             <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
               <div
                className={`h-full rounded-full ${utilizationPct > 80 ?"bg-amber-500" :"bg-emerald-500"}`}
                style={{ width: `${Math.min(utilizationPct, 100)}%` }}
               />
              </div>
              <span className="text-[11px] font-mono text-muted-foreground w-8 text-right">
               {utilizationPct}%
              </span>
             </div>
            ) : (
             <span className="text-[12px] text-muted-foreground/40">No budget</span>
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
    <div className="bg-card border border-border rounded-[2px] shadow-sm">
     <div className="flex items-center gap-3 px-5 py-3 bg-violet-500/[0.02] transition-colors">
      <div className="w-6 h-6 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
       <CircleDot className="w-3.5 h-3.5 text-violet-400" />
      </div>
      <div className="text-[15px] font-medium text-violet-100">Recent Issues</div>
     </div>
     <div className="flex flex-col">
      {recentIssues.map((issue, i) => (
       <div
        key={issue.id}
        onClick={() => navigate("issue-detail", { projectSlug: issue.project, issueId: issue.id })}
        className={`flex items-center gap-4 px-[20px] py-3 hover:bg-accent/40 transition-colors cursor-pointer ${
         i < recentIssues.length - 1 ?"border-b border-border/50" :""
        }`}
        tabIndex="0"
       >
        <PriorityDot priority={issue.priority} />
        <StatusCircle status={issue.status} />
        <span className="text-[12px] font-mono text-muted-foreground shrink-0 whitespace-nowrap">{issue.id}</span>
        <span className="text-[14px] text-foreground flex-1 truncate">{issue.title}</span>
        <StatusBadge status={issue.status} />
        {issue.assignee && (
         <span className="text-[12px] text-muted-foreground shrink-0 capitalize hidden sm:inline">
          {issue.assignee}
         </span>
        )}
        <span className="text-[12px] text-muted-foreground w-16 text-right font-mono shrink-0 hidden sm:inline">
         {timeAgo(issue.updated)}
        </span>
       </div>
      ))}
     </div>
    </div>
   )}
  </div>
 );
}
