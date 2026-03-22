import { useState, useEffect } from"react";
import { getFile, getProjectCosts, getBudgetPolicy, updateBudgetPolicy, getApprovals, resolveApproval, updateIssue, deleteIssue, getExperiments, getThemes } from"../api.js";
import { formatDate as formatDateUtil, formatTimeAgo } from"../utils/formatDate.js";
import {
 ArrowLeft, FileText, Activity, DollarSign, Clock,
 User, Wallet, Target, ShieldCheck, Bot, CircleDot, Pencil, FlaskConical, Compass, BarChart3,
} from"lucide-react";
import Markdown from"../components/Markdown.jsx";
import { Skeleton } from"../components/ui/Skeleton.jsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from"../components/ui/Tabs.jsx";
import { StatusBadge } from"../components/StatusBadge.jsx";
import { MetricCard } from"../components/MetricCard.jsx";
import { EmptyState } from"../components/EmptyState.jsx";
import { ActivityRow } from"../components/ActivityRow.jsx";
import { QuotaBar } from"../components/QuotaBar.jsx";
import { CostTimeline } from"../components/CostTimeline.jsx";
import { BurnRateIndicator } from"../components/BurnRateIndicator.jsx";
import { BudgetEditModal } from"../components/BudgetEditModal.jsx";
import Issues from"./Issues.jsx";
import { CollapsibleSection } from"../components/CollapsibleSection.jsx";
import ApprovalCard from "../components/ApprovalCard.jsx";
import { RejectModal } from "../components/RejectModal.jsx";

const TABS = [
 { id:"overview", label:"Overview", icon: FileText },
 { id:"strategy", label:"Strategy", icon: Compass },
 { id:"issues", label:"Issues", icon: CircleDot },
 { id:"experiments", label:"Experiments", icon: FlaskConical },
 { id:"standups", label:"Standups", icon: Activity },
 { id:"costs", label:"Costs", icon: DollarSign },
 { id:"approvals", label:"Approvals", icon: ShieldCheck },
 { id:"activity", label:"Activity", icon: Clock },
];

function parseProjectMd(raw) {
 if (!raw) return {};
 const titleMatch = raw.match(/^#\s+(.+)/m);
 const leadMatch = raw.match(/\*\*Lead:\*\*\s*(\S+)/);
 const budgetMatch = raw.match(/\*\*Budget:\*\*\s*(.+)/);
 const statusMatch = raw.match(/\*\*Status:\*\*\s*(\S+)/);
 const createdMatch = raw.match(/\*\*Created:\*\*\s*(\S+)/);
 const missionMatch = raw.match(/## Mission\s*(?:\/\s*Goal)?\n+([\s\S]*?)(?=\n## |$)/);
 const gatesMatch = raw.match(/## Approval Gates\n+([\s\S]*?)(?=\n## |$)/);
 const nsmMatch = raw.match(/\*\*NSM:\*\*\s*(.+)/);
 const subagentsMatch = raw.match(/## Sub-agents\n+([\s\S]*?)(?=\n## |$)/);
 return {
  title: titleMatch?.[1] ||"",
  lead: leadMatch?.[1] ||"unassigned",
  budget: budgetMatch?.[1]?.trim() ||"none",
  status: statusMatch?.[1] ||"unknown",
  created: createdMatch?.[1] ||"",
  nsm: nsmMatch?.[1]?.trim() || null,
  mission: missionMatch?.[1]?.trim() ||"",
  gates: gatesMatch?.[1]?.trim() ||"",
  subagents: subagentsMatch?.[1]?.trim() ||"",
 };
}

function parseActivityLog(raw) {
 if (!raw) return [];
 return raw
  .trim()
  .split("\n")
  .filter((l) => l.trim())
  .map((line) => {
   const m = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*\|\s*(\S+)\s*\|\s*(.+)/);
   if (m) return { time: m[1], agent: m[2], event: m[3] };
   return { time:"", agent:"", event: line };
  })
  .reverse();
}

export default function ProjectDetail({ projectId, navigate, initialTab }) {
 const [tab, setTab] = useState(initialTab ||"overview");

 // Sync tab from URL when navigating via back/forward
 useEffect(() => {
  if (initialTab && initialTab !== tab) setTab(initialTab);
 }, [initialTab]);

 const handleTabChange = (newTab) => {
  setTab(newTab);
  navigate("project-tab", { slug: projectId, tab: newTab });
 };
 const [projectRaw, setProjectRaw] = useState(null);
 const [milestones, setMilestones] = useState(null);
 const [standups, setStandups] = useState([]);
 const [costs, setCosts] = useState([]);
 const [costSummary, setCostSummary] = useState(null);
 const [budgetPolicy, setBudgetPolicy] = useState(null);
 const [showBudgetModal, setShowBudgetModal] = useState(false);
 const [savingBudget, setSavingBudget] = useState(false);
 const [activityLog, setActivityLog] = useState("");
 const [approvals, setApprovals] = useState([]);
 const [experiments, setExperiments] = useState([]);
 const [themes, setThemes] = useState([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
  Promise.all([
   getFile(`shared/projects/${projectId}/PROJECT.md`).catch(() => null),
   getFile(`shared/projects/${projectId}/milestones.md`).catch(() => null),
   getFile(`shared/projects/${projectId}/activity.log`).catch(() => null),
   loadStandups(projectId),
   loadCosts(projectId),
   getProjectCosts(projectId).catch(() => null),
   getBudgetPolicy(projectId).catch(() => null),
   getApprovals(projectId).catch(() => []),
   getExperiments(projectId).catch(() => []),
   getThemes(projectId).catch(() => []),
  ]).then(([proj, miles, activity, standupList, costList, costData, policyData, approvalList, experimentList, themeList]) => {
   setProjectRaw(proj?.content || null);
   setMilestones(miles?.content || null);
   setActivityLog(activity?.content ||"");
   setStandups(standupList);
   setCosts(costList);
   setCostSummary(costData);
   setBudgetPolicy(policyData?.policy || null);
   setApprovals(approvalList);
   setExperiments(experimentList);
   setThemes(themeList);
   setLoading(false);
  });
 }, [projectId]);

 const handleSaveBudget = async (data) => {
  setSavingBudget(true);
  try {
   const result = await updateBudgetPolicy(data);
   setBudgetPolicy(result.policy);
   // Refresh cost summary
   const updated = await getProjectCosts(projectId).catch(() => null);
   if (updated) setCostSummary(updated);
   setShowBudgetModal(false);
  } catch (e) {
   console.error("Failed to save budget:", e);
  } finally {
   setSavingBudget(false);
  }
 };

 const project = parseProjectMd(projectRaw);
 const activities = parseActivityLog(activityLog);
 const totalCost = costs.reduce((sum, c) => sum + (c.total_usd || 0), 0);

 if (loading) {
  return (
   <div className="space-y-4 p-4">
    <Skeleton className="h-6 w-48" />
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-32 w-full" />
   </div>
  );
 }

 return (
  <div className="space-y-6">
   {/* Breadcrumb bar */}
   <div className="h-12 flex items-center gap-2">
    <button
     onClick={() => navigate("overview")}
     className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
    >
     Dashboard
    </button>
    <span className="text-muted-foreground/40">›</span>
    <span className="text-[13px] font-semibold text-foreground truncate">
     {project.title || projectId}
    </span>
   </div>

   {/* Project header */}
   <div>
    <div className="flex items-center gap-3 mb-2">
     <h2 className="text-3xl font-semibold text-foreground">
      {project.title || projectId}
     </h2>
     <StatusBadge status={project.status} />
    </div>
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
     <span
      className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors"
      onClick={() => {
       const name = project.lead.toLowerCase();
       const workspaceId = name ==="sam" ?"workspace" : `workspace-${name}`;
       navigate("agent-detail", workspaceId);
      }}
     >
      <User size={12} />
      {project.lead}
     </span>
     <span className="flex items-center gap-1.5 font-mono tabular-nums">
      <Wallet size={12} />
      {project.budget}
     </span>
     {project.created && (
      <span className="flex items-center gap-1.5">
       <Clock size={12} />
       {formatDateUtil(project.created)}
      </span>
     )}
     {totalCost > 0 && (
      <span className="flex items-center gap-1.5 font-mono tabular-nums">
       <DollarSign size={12} />
       ${totalCost.toFixed(2)} spent
      </span>
     )}
    </div>
   </div>

   {/* Tabs */}
   <Tabs value={tab} onValueChange={handleTabChange}>
    <TabsList>
     {TABS.map(({ id, label, icon: Icon }) => {
      const pendingCount = id ==="approvals"
       ? approvals.filter((a) => !a.status || a.status ==="pending").length
       : 0;
      return (
       <TabsTrigger key={id} value={id}>
        <Icon size={14} strokeWidth={1.8} />
        {label}
        {pendingCount > 0 && (
         <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-amber-900/50 text-amber-300 text-[11px] font-medium px-1">
          {pendingCount}
         </span>
        )}
       </TabsTrigger>
      );
     })}
    </TabsList>

    {/* Overview tab */}
    <TabsContent value="overview">
     <div className="space-y-4">
      {project.mission && (
       <div className="bg-card rounded-sm border border-border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
         <Target size={14} className="text-muted-foreground/50" />
         <h3 className="text-sm font-semibold text-muted-foreground">
          Mission / Goal
         </h3>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">{project.mission}</p>
       </div>
      )}

      {milestones && (
       <div className="bg-card rounded-sm border border-border shadow-sm p-5">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
         Milestones
        </h3>
        <Markdown content={milestones} />
       </div>
      )}

      {project.gates && (
       <div className="bg-card rounded-sm border border-border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
         <ShieldCheck size={14} className="text-muted-foreground/50" />
         <h3 className="text-sm font-semibold text-muted-foreground">
          Approval Gates
         </h3>
        </div>
        <div className="divide-y divide-border">
         {project.gates
          .split("\n")
          .filter(Boolean)
          .map((gate, i) => {
           const text = gate.replace(/^-\s*/,"");
           const [name, requires] = text.split(":").map((s) => s.trim());
           return (
            <div key={i} className="flex items-center justify-between py-2 text-sm">
             <span className="text-foreground/80">{name}</span>
             {requires && (
              <span className="text-xs text-muted-foreground font-mono">
               {requires}
              </span>
             )}
            </div>
           );
          })}
        </div>
       </div>
      )}

      {project.subagents && !project.subagents.includes("(none") && (
       <div className="bg-card rounded-sm border border-border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
         <Bot size={14} className="text-muted-foreground/50" />
         <h3 className="text-sm font-semibold text-muted-foreground">
          Sub-agents
         </h3>
        </div>
        <Markdown content={project.subagents} />
       </div>
      )}
     </div>
    </TabsContent>

    {/* Strategy tab */}
    <TabsContent value="strategy">
     <StrategyTab project={project} themes={themes} projectId={projectId} navigate={navigate} />
    </TabsContent>

    {/* Issues tab */}
    <TabsContent value="issues">
     <Issues projectSlug={projectId} navigate={navigate} themes={themes.filter((t) => t.status === "approved")} />
    </TabsContent>

    {/* Experiments tab */}
    <TabsContent value="experiments">
     <ExperimentsTab experiments={experiments} />
    </TabsContent>

    {/* Standups tab */}
    <TabsContent value="standups">
     {standups.length === 0 ? (
      <EmptyState icon={Activity} text="No standups yet" sub="The lead will post daily updates here." />
     ) : (
      <div className="space-y-2">
       {standups.map((s, i) => {
        const isLatest = i === 0;
        const dateStr = s.name.replace(".md","");
        const displayDate = (() => {
         try { return formatDateUtil(dateStr +"T00:00:00"); } catch { return dateStr; }
        })();
        return (
         <CollapsibleSection
          key={s.name}
          title={displayDate}
          defaultOpen={isLatest}
         >
          <Markdown content={s.content} />
         </CollapsibleSection>
        );
       })}
      </div>
     )}
    </TabsContent>

    {/* Costs tab */}
    <TabsContent value="costs">
     <ProjectCostsTab
      costs={costs}
      costSummary={costSummary}
      budgetPolicy={budgetPolicy}
      totalCost={totalCost}
      projectId={projectId}
      onEditBudget={() => setShowBudgetModal(true)}
     />
     {showBudgetModal && (
      <BudgetEditModal
       project={projectId}
       policy={budgetPolicy}
       onSave={handleSaveBudget}
       onClose={() => setShowBudgetModal(false)}
       saving={savingBudget}
      />
     )}
    </TabsContent>

    {/* Approvals tab */}
    <TabsContent value="approvals">
     <ProjectApprovalsTab
      approvals={approvals}
      projectId={projectId}
      navigate={navigate}
      onResolved={() => {
       getApprovals(projectId)
        .then(setApprovals)
        .catch(() => {});
      }}
     />
    </TabsContent>

    {/* Activity tab */}
    <TabsContent value="activity">
     {activities.length === 0 ? (
      <EmptyState icon={Clock} text="No activity yet" sub="Events will appear as the project progresses." />
     ) : (
      <GroupedActivityList activities={activities} />
     )}
    </TabsContent>
   </Tabs>
  </div>
 );
}

function StrategyTab({ project, themes, projectId, navigate }) {
 const approvedThemes = themes.filter((t) => t.status === "approved");
 const pendingThemes = themes.filter((t) => t.status === "proposed");

 return (
  <div className="space-y-4">
   {/* North Star Metric */}
   <div className="border border-border border-l-2 border-l-cyan-400 bg-accent/20 p-4">
    <div className="flex items-center gap-2 mb-2">
     <Target size={14} className="text-cyan-400" />
     <h3 className="text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground">
      North Star Metric
     </h3>
    </div>
    {project.nsm ? (
     <p className="text-sm font-medium text-foreground">{project.nsm}</p>
    ) : (
     <p className="text-sm text-muted-foreground/60">No NSM defined yet.</p>
    )}
    {project.mission && (
     <p className="text-xs text-muted-foreground mt-2">
      Mission: {project.mission}
     </p>
    )}
   </div>

   {/* Pending theme proposals */}
   {pendingThemes.length > 0 && (
    <div>
     <h3 className="text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground mb-2">
      Proposed Themes
     </h3>
     <div className="space-y-2">
      {pendingThemes.map((theme) => (
       <div key={theme.id} className="border border-amber-700/40 bg-amber-900/10 p-4">
        <div className="flex items-center gap-2 mb-2">
         <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-900/50 text-amber-300">
          <Clock size={12} /> Pending
         </span>
         <span className="text-sm font-medium text-foreground">{theme.title}</span>
        </div>
        {theme.description && (
         <p className="text-xs text-muted-foreground mb-3">{theme.description}</p>
        )}
        <div className="space-y-1.5">
         {(theme.proxy_metrics || []).map((pm) => (
          <div key={pm.id} className="flex items-center gap-2 text-xs">
           <BarChart3 size={12} className="text-muted-foreground/50 shrink-0" />
           <span className="text-foreground/80">{pm.name}</span>
          </div>
         ))}
        </div>
        <p className="text-[11px] text-muted-foreground/50 mt-2">
         Proposed by {theme.proposed_by} — awaiting approval
        </p>
       </div>
      ))}
     </div>
    </div>
   )}

   {/* Approved themes */}
   {approvedThemes.length > 0 ? (
    <div>
     <h3 className="text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground mb-2">
      Key Themes
     </h3>
     <div className="space-y-2">
      {approvedThemes.map((theme) => (
       <div key={theme.id} className="border border-border p-4">
        <div className="flex items-center gap-2 mb-1">
         <Compass size={14} className="text-teal-400 shrink-0" />
         <h4 className="text-sm font-medium text-foreground">{theme.title}</h4>
        </div>
        {theme.description && (
         <p className="text-xs text-muted-foreground mb-3 ml-[22px]">{theme.description}</p>
        )}
        <div className="space-y-2 ml-[22px]">
         {(theme.proxy_metrics || []).map((pm) => (
          <div key={pm.id} className="flex items-start gap-2">
           <BarChart3 size={12} className="text-muted-foreground/50 mt-0.5 shrink-0" />
           <div>
            <span className="text-xs font-medium text-foreground/80">{pm.name}</span>
            {pm.description && (
             <p className="text-[11px] text-muted-foreground/60">{pm.description}</p>
            )}
           </div>
          </div>
         ))}
        </div>
       </div>
      ))}
     </div>
    </div>
   ) : !pendingThemes.length && (
    <EmptyState
     icon={Compass}
     text="No themes yet"
     sub="The lead agent will propose themes after reviewing the mission and NSM."
    />
   )}
  </div>
 );
}

function GroupedActivityList({ activities }) {
 // Group activities by date (YYYY-MM-DD from the time field)
 const groups = {};
 for (const a of activities) {
  const dateKey = a.time ? a.time.split("")[0] :"unknown";
  if (!groups[dateKey]) groups[dateKey] = [];
  groups[dateKey].push(a);
 }
 const groupEntries = Object.entries(groups);

 return (
  <div className="space-y-2">
   {groupEntries.map(([dateKey, items], gi) => {
    const isLatest = gi === 0;
    const displayDate = (() => {
     try { return formatDateUtil(dateKey +"T00:00:00"); } catch { return dateKey; }
    })();
    return (
     <CollapsibleSection key={dateKey} title={displayDate} defaultOpen={isLatest}>
      <div className="divide-y divide-border border border-border">
       {items.map((a, i) => (
        <ActivityRow key={i} time={a.time} agent={a.agent} event={a.event} />
       ))}
      </div>
     </CollapsibleSection>
    );
   })}
  </div>
 );
}

function ProjectCostsTab({ costs, costSummary, budgetPolicy, totalCost, projectId, onEditBudget }) {
 const cs = costSummary || {};
 const budget = cs.budget || 0;
 const utilizationPct = cs.utilizationPct || 0;
 const remaining = cs.remaining || 0;
 const dailyBurnRate = cs.dailyBurnRate || 0;
 const exhaustionDate = cs.exhaustionDate;
 const entries = cs.entries || [];
 const agentSummaries = cs.agents || [];

 if (costs.length === 0 && entries.length === 0) {
  return (
   <EmptyState icon={DollarSign} text="No cost data yet" sub="Agents will log their token usage here." />
  );
 }

 return (
  <div className="space-y-4">
   {/* Budget policy card */}
   <div className="bg-card rounded-sm border border-border shadow-sm p-5 space-y-3">
    <div className="flex items-center justify-between">
     <div className="flex items-center gap-2">
      <Wallet size={14} className="text-muted-foreground/50" />
      <h3 className="text-sm font-semibold text-muted-foreground">
       Budget Policy
      </h3>
     </div>
     <button
      onClick={onEditBudget}
      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
     >
      <Pencil size={12} />
      Edit Budget
     </button>
    </div>

    {budget > 0 && (
     <QuotaBar
      label="Weekly Budget"
      percentUsed={utilizationPct}
      leftLabel={`$${totalCost.toFixed(2)} / $${budget}`}
      rightLabel={`${utilizationPct}%`}
     />
    )}

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
     <div>
      <p className="text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground/60">Spend</p>
      <p className="text-lg font-semibold font-mono tabular-nums mt-0.5">${totalCost.toFixed(2)}</p>
     </div>
     <div>
      <p className="text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground/60">Budget</p>
      <p className="text-lg font-semibold font-mono tabular-nums mt-0.5">
       {budget > 0 ? `$${budget}/wk` :"No cap"}
      </p>
     </div>
     <div>
      <p className="text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground/60">Remaining</p>
      <p className="text-lg font-semibold font-mono tabular-nums mt-0.5">
       {budget > 0 ? `$${remaining.toFixed(2)}` :"--"}
      </p>
     </div>
     <div>
      <p className="text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground/60">Burn Rate</p>
      <div className="mt-0.5">
       <BurnRateIndicator dailyRate={dailyBurnRate} compact />
      </div>
     </div>
    </div>

    {exhaustionDate && (
     <p className="text-xs text-muted-foreground">
      Projected exhaustion: <span className="font-mono tabular-nums">{exhaustionDate}</span>
     </p>
    )}

    {budgetPolicy && (
     <div className="flex gap-4 text-[11px] text-muted-foreground/50 pt-1 border-t border-border/50">
      <span>Warn: {Math.round((budgetPolicy.warn_threshold || 0.8) * 100)}%</span>
      <span>Stop: {Math.round((budgetPolicy.stop_threshold || 1.0) * 100)}%</span>
      {budgetPolicy.per_agent_limits && Object.keys(budgetPolicy.per_agent_limits).length > 0 && (
       <span>
        Agent limits: {Object.entries(budgetPolicy.per_agent_limits)
         .map(([a, l]) => `${a}: $${l}`)
         .join(",")}
       </span>
      )}
     </div>
    )}
   </div>

   {/* Summary metrics */}
   <div className="grid grid-cols-2 gap-1">
    <MetricCard
     label="Total Spend"
     value={`$${totalCost.toFixed(2)}`}
     mono
    />
    <MetricCard
     label="Entries"
     value={entries.length || costs.reduce((sum, c) => sum + (c.entries?.length || 0), 0)}
    />
   </div>

   {/* Per-agent breakdown */}
   {(agentSummaries.length > 0 || costs.length > 0) && (
    <div>
     <h4 className="text-sm font-semibold text-muted-foreground mb-2">
      Per-Agent Breakdown
     </h4>
     <div className="border border-border divide-y divide-border">
      {(agentSummaries.length > 0 ? agentSummaries : costs).map((c) => {
       const agentName = c.agent;
       const agentTotal = c.totalUsd ?? c.total_usd ?? 0;
       const agentLimit = budgetPolicy?.per_agent_limits?.[agentName];
       const agentPct = agentLimit ? Math.round((agentTotal / agentLimit) * 100) : null;

       return (
        <div key={agentName} className="px-4 py-3">
         <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-foreground">{agentName}</span>
          <span className="text-sm font-mono tabular-nums text-foreground">
           ${agentTotal.toFixed(2)}
          </span>
         </div>
         {agentLimit && (
          <QuotaBar
           label=""
           percentUsed={agentPct}
           leftLabel={`$${agentTotal.toFixed(2)} / $${agentLimit}`}
           rightLabel={`${agentPct}%`}
           className="mt-1"
          />
         )}
         <p className="text-[11px] text-muted-foreground/50 mt-1">
          {c.entryCount ?? c.entries?.length ?? 0} entries
          {agentLimit ? ` | Limit: $${agentLimit}` :""}
         </p>
        </div>
       );
      })}
     </div>
    </div>
   )}

   {/* Cost timeline */}
   {entries.length > 0 && (
    <div>
     <h4 className="text-sm font-semibold text-muted-foreground mb-2">
      Cost Timeline
     </h4>
     <CostTimeline entries={entries.slice(0, 50)} />
    </div>
   )}
  </div>
 );
}

function ProjectApprovalsTab({ approvals, projectId, onResolved, navigate }) {
 const [rejectingApproval, setRejectingApproval] = useState(null);

 async function handleApprove(approval) {
  try {
   if (approval._source ==="issue") {
    await updateIssue(approval.id, projectId, { status:"todo" });
   } else {
    await resolveApproval({
     project: approval._project || approval.project || projectId,
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
   onResolved();
  } catch (err) {
   console.error("Approve failed:", err);
  }
 }

 async function handleReject(approval) {
  if (approval._source ==="issue") {
   try {
    await deleteIssue(approval.id, projectId);
    onResolved();
   } catch (err) {
    console.error("Reject failed:", err);
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
    project: approval._project || approval.project || projectId,
    id: approval.id,
    decision: "rejected",
    comment,
    requester: approval.requester,
    gate: approval.gate,
    what: approval.what || approval.title,
    why: approval.why,
    created: approval.created,
   });
   onResolved();
  } catch (err) {
   console.error("Reject failed:", err);
  }
 }

 const pendingCount = approvals.filter(
  (a) => !a.status || a.status ==="pending"
 ).length;

 if (approvals.length === 0) {
  return (
   <EmptyState
    icon={ShieldCheck}
    text="No approvals"
    sub="All clear — no approvals for this project."
   />
  );
 }

 return (
  <div className="space-y-3">
   {pendingCount > 0 && (
    <p className="text-xs text-muted-foreground">
     {pendingCount} pending
    </p>
   )}
   <div className="border border-border overflow-hidden">
    {approvals.map((approval) => (
     <ApprovalCard
      key={approval.id || approval._file}
      approval={approval}
      onApprove={handleApprove}
      onReject={handleReject}
      navigate={navigate}
      hideProject={true}
     />
    ))}
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

function ExperimentsTab({ experiments }) {
 if (!experiments || experiments.length === 0) {
  return (
   <EmptyState
    icon={FlaskConical}
    text="No experiments yet"
    sub="The lead can start one via the autoresearch protocol."
   />
  );
 }

 // Compute summary across all experiments
 const totalRuns = experiments.reduce((sum, e) => sum + e.result_count, 0);
 const bestMetrics = experiments.map((e) => e.best_metric).filter((m) => m !== null && m !== undefined);
 const overallBest = bestMetrics.length > 0 ? Math.max(...bestMetrics) : null;
 const latestExp = experiments[experiments.length - 1];
 const currentMetric = latestExp?.best_metric;

 return (
  <div className="space-y-4">
   {/* Summary cards */}
   <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
    <MetricCard label="Experiments" value={experiments.length} />
    <MetricCard label="Total Runs" value={totalRuns} />
    {overallBest !== null && (
     <MetricCard label="Best Metric" value={overallBest} mono />
    )}
   </div>

   {/* Experiment list */}
   {experiments.map((exp) => (
    <CollapsibleSection
     key={exp.dir}
     title={
      <span className="flex items-center gap-2">
       <span>{exp.name}</span>
       <StatusBadge status={exp.status} />
       {exp.result_count > 0 && (
        <span className="text-[11px] text-muted-foreground font-mono">
         {exp.result_count} run{exp.result_count !== 1 ?"s" :""}
        </span>
       )}
      </span>
     }
     defaultOpen={experiments.length === 1}
    >
     <div className="space-y-3">
      {/* Program definition */}
      {exp.program_md && (
       <div className="bg-card rounded-sm border border-border shadow-sm p-5">
        <Markdown content={exp.program_md} />
       </div>
      )}

      {/* Results table */}
      {exp.results.length > 0 && (
       <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">
         Results
        </h4>
        <div className="border border-border overflow-x-auto">
         <table className="w-full text-sm">
          <thead>
           <tr className="border-b border-border bg-muted/30">
            {Object.keys(exp.results[0]).map((col) => (
             <th
              key={col}
              className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground font-medium"
             >
              {col}
             </th>
            ))}
           </tr>
          </thead>
          <tbody className="divide-y divide-border">
           {exp.results.map((row, i) => (
            <tr key={i} className="hover:bg-muted/20 transition-colors">
             {Object.values(row).map((val, j) => (
              <td key={j} className="px-3 py-2 font-mono text-xs text-foreground/80">
               {val}
              </td>
             ))}
            </tr>
           ))}
          </tbody>
         </table>
        </div>
       </div>
      )}

      {/* Per-experiment summary */}
      {exp.best_metric !== null && (
       <div className="flex gap-4 text-xs text-muted-foreground">
        <span>Best metric: <span className="font-mono font-medium text-foreground">{exp.best_metric}</span></span>
        <span>Runs: <span className="font-mono font-medium text-foreground">{exp.result_count}</span></span>
       </div>
      )}
     </div>
    </CollapsibleSection>
   ))}
  </div>
 );
}

async function loadStandups(projectId) {
 try {
  const dir = await getFile(`shared/projects/${projectId}/standups`);
  if (dir.type !=="directory" || !dir.entries) return [];
  const files = dir.entries.filter((e) => e.type ==="file" && e.name.endsWith(".md"));
  return Promise.all(
   files.sort((a, b) => b.name.localeCompare(a.name)).map(async (f) => {
    const data = await getFile(`shared/projects/${projectId}/standups/${f.name}`);
    return { name: f.name, content: data.content ||"" };
   })
  );
 } catch {
  return [];
 }
}

async function loadCosts(projectId) {
 try {
  const dir = await getFile(`shared/projects/${projectId}/costs`);
  if (dir.type !=="directory" || !dir.entries) return [];
  const files = dir.entries.filter((e) => e.type ==="file" && e.name.endsWith(".json"));
  return Promise.all(
   files.map(async (f) => {
    const data = await getFile(`shared/projects/${projectId}/costs/${f.name}`);
    return data.content || {};
   })
  );
 } catch {
  return [];
 }
}
