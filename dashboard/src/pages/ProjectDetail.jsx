import { useState, useEffect } from"react";
import { getFile, getProjectCosts, getBudgetPolicy, updateBudgetPolicy, getApprovals, resolveApproval, updateIssue, deleteIssue, getExperiments, getThemes, getIssues } from"../api.js";
import { formatDate as formatDateUtil, formatTimeAgo } from"../utils/formatDate.js";
import {
 ArrowLeft, FileText, Activity, DollarSign, Clock,
 User, Wallet, Target, ShieldCheck, Bot, CircleDot, Pencil, FlaskConical, Compass, BarChart3, CheckCircle2,
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
import { CreateExperiment } from "../components/CreateExperiment.jsx";

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
   <div className="max-w-[1400px] mx-auto space-y-4">
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-8 w-64 mb-2" />
    <Skeleton className="h-4 w-48" />
    <Skeleton className="h-64 w-full rounded-[2px] mt-4" />
   </div>
  );
 }

 return (
  <div className="max-w-[1400px] mx-auto">
   {/* Header area — matches Aura's space-y-4 */}
   <div className="space-y-4">
    {/* Breadcrumb — Aura: nav text-sm text-zinc-500 */}
    <nav className="flex items-center text-[13px] text-muted-foreground">
     <button
      onClick={() => navigate("overview")}
      className="hover:text-foreground transition-colors"
     >
      Projects
     </button>
     <span className="mx-2">›</span>
     <span className="text-muted-foreground/80">
      {project.title || projectId}
     </span>
    </nav>

    {/* Title + status — Aura: text-3xl font-semibold tracking-tight + badge */}
    <div>
     <div className="flex items-center gap-4">
      <h1 className="text-3xl font-semibold text-foreground tracking-tight">
       {project.title || projectId}
      </h1>
      <StatusBadge status={project.status} />
     </div>

     {/* Metadata — Aura: text-sm text-zinc-500 with dot separators */}
     <div className="flex items-center gap-2 mt-3 text-[13px] text-muted-foreground">
      <span
       className="hover:text-foreground transition-colors cursor-pointer capitalize"
       onClick={() => {
        const name = project.lead.toLowerCase();
        const workspaceId = name ==="sam" ?"workspace" : `workspace-${name}`;
        navigate("agent-detail", workspaceId);
       }}
      >
       {project.lead}
      </span>
      <span>·</span>
      <span className="font-mono tabular-nums">{project.budget}</span>
      {project.created && (
       <>
        <span>·</span>
        <span>{formatDateUtil(project.created)}</span>
       </>
      )}
      {totalCost > 0 && (
       <>
        <span>·</span>
        <span className="font-mono tabular-nums">${totalCost.toFixed(2)} spent</span>
       </>
      )}
     </div>
    </div>
   </div>

   {/* Tabs — Aura: mt-8 border-b, gap-8 */}
   <Tabs value={tab} onValueChange={handleTabChange} className="mt-8">
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
         <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400 text-[11px] font-medium px-1">
          {pendingCount}
         </span>
        )}
       </TabsTrigger>
      );
     })}
    </TabsList>

    {/* ──────────────── OVERVIEW TAB ──────────────── */}
    {/* Aura: grid-cols-3 with xl:col-span-2 left */}
    <TabsContent value="overview">
     <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
      {/* Left column — 2/3 */}
      <div className="xl:col-span-2 space-y-6">
       {/* Mission / Goal — Aura card */}
       {project.mission && (
        <div className="bg-card border border-border rounded-[2px] shadow-sm">
         <div className="px-5 py-4 border-b border-border">
          <h2 className="text-[14px] font-medium text-foreground">Mission / Goal</h2>
         </div>
         <div className="p-5 text-[14px] text-foreground/80 leading-relaxed">
          <p>{project.mission}</p>
         </div>
        </div>
       )}

       {/* Themes — Aura milestones card styling */}
       {themes.filter((t) => t.status === "approved").length > 0 && (
        <div className="bg-card border border-border rounded-[2px] shadow-sm">
         <div className="px-5 py-4 border-b border-border">
          <h2 className="text-[14px] font-medium text-foreground">Themes</h2>
         </div>
         <div className="flex flex-col">
          {themes.filter((t) => t.status === "approved").map((theme, i, arr) => (
           <div
            key={theme.id}
            className={`px-5 py-4 flex gap-4 items-start ${i < arr.length - 1 ?"border-b border-border/50" :""}`}
           >
            <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
            <div>
             <h3 className="text-[14px] font-medium text-foreground">{theme.title}</h3>
             {theme.description && (
              <p className="text-[14px] text-muted-foreground mt-1">{theme.description}</p>
             )}
            </div>
           </div>
          ))}
         </div>
        </div>
       )}
      </div>

      {/* Right column — 1/3 */}
      <div className="space-y-6">
       {/* Details — Aura: flex justify-between rows */}
       <div className="bg-card border border-border rounded-[2px] shadow-sm">
        <div className="px-5 py-4 border-b border-border">
         <h2 className="text-[14px] font-medium text-foreground">Details</h2>
        </div>
        <div className="p-5 flex flex-col gap-4">
         <div className="flex justify-between items-center">
          <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Status</span>
          <StatusBadge status={project.status} />
         </div>
         <div className="flex justify-between items-center">
          <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Lead</span>
          <span
           className="text-[14px] text-foreground cursor-pointer hover:underline capitalize"
           onClick={() => {
            const name = project.lead.toLowerCase();
            const workspaceId = name ==="sam" ?"workspace" : `workspace-${name}`;
            navigate("agent-detail", workspaceId);
           }}
          >
           {project.lead}
          </span>
         </div>
         <div className="flex justify-between items-center">
          <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Budget</span>
          <span className="text-[14px] text-foreground font-mono tabular-nums">{project.budget}</span>
         </div>
         {project.created && (
          <div className="flex justify-between items-center">
           <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Created</span>
           <span className="text-[14px] text-foreground">{formatDateUtil(project.created)}</span>
          </div>
         )}
         {project.nsm && (
          <div className="flex justify-between items-start">
           <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">North Star</span>
           <span className="text-[14px] text-foreground text-right max-w-[60%]">{project.nsm}</span>
          </div>
         )}
        </div>
       </div>

       {/* Sub-agents — Aura card with count badge and hover rows */}
       {project.subagents && !project.subagents.includes("(none") && (
        <div className="bg-card border border-border rounded-[2px] shadow-sm">
         <div className="px-5 py-4 border-b border-border flex justify-between items-center">
          <h2 className="text-[14px] font-medium text-foreground">Sub-agents</h2>
         </div>
         <div className="p-5">
          <Markdown content={project.subagents} />
         </div>
        </div>
       )}

       {/* Approval Gates — Aura card */}
       {project.gates && (
        <div className="bg-card border border-border rounded-[2px] shadow-sm">
         <div className="px-5 py-4 border-b border-border">
          <h2 className="text-[14px] font-medium text-foreground">Approval Gates</h2>
         </div>
         <div className="p-5 text-[14px] text-muted-foreground space-y-3">
          {project.gates
           .split("\n")
           .filter(Boolean)
           .map((gate, i) => {
            const text = gate.replace(/^-\s*/,"");
            const [name, requires] = text.split(":").map((s) => s.trim());
            return (
             <div key={i} className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-[4px] border border-muted-foreground/40 shrink-0" />
              <span className="text-foreground/80">{name}</span>
             </div>
            );
           })}
         </div>
        </div>
       )}
      </div>
     </div>
    </TabsContent>

    {/* ──────────────── STRATEGY TAB ──────────────── */}
    <TabsContent value="strategy">
     <div className="mt-6">
      <StrategyTab project={project} themes={themes} projectId={projectId} navigate={navigate} />
     </div>
    </TabsContent>

    {/* ──────────────── ISSUES TAB ──────────────── */}
    <TabsContent value="issues">
     <div className="mt-6">
      <Issues projectSlug={projectId} navigate={navigate} themes={themes.filter((t) => t.status === "approved")} />
     </div>
    </TabsContent>

    {/* ──────────────── EXPERIMENTS TAB ──────────────── */}
    <TabsContent value="experiments">
     <div className="mt-6">
      <ExperimentsTab experiments={experiments} themes={themes.filter((t) => t.status === "approved")} projectSlug={projectId} onRefresh={() => getExperiments(projectId).then(setExperiments)} />
     </div>
    </TabsContent>

    {/* ──────────────── STANDUPS TAB ──────────────── */}
    <TabsContent value="standups">
     <div className="mt-6">
      {standups.length === 0 ? (
       <EmptyState icon={Activity} text="No standups yet" sub="The lead will post daily updates here." />
      ) : (
       <div className="space-y-4">
        {standups.map((s, i) => {
         const isLatest = i === 0;
         const dateStr = s.name.replace(".md","");
         const displayDate = (() => {
          try { return formatDateUtil(dateStr +"T00:00:00"); } catch { return dateStr; }
         })();
         return (
          <div key={s.name} className="bg-card border border-border rounded-[2px] shadow-sm">
           <div className="px-5 py-4 border-b border-border">
            <h2 className="text-[14px] font-medium text-foreground">{displayDate}</h2>
           </div>
           <div className="p-5">
            <Markdown content={s.content} />
           </div>
          </div>
         );
        })}
       </div>
      )}
     </div>
    </TabsContent>

    {/* ──────────────── COSTS TAB ──────────────── */}
    <TabsContent value="costs">
     <div className="mt-6">
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
     </div>
    </TabsContent>

    {/* ──────────────── APPROVALS TAB ──────────────── */}
    <TabsContent value="approvals">
     <div className="mt-6">
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
     </div>
    </TabsContent>

    {/* ──────────────── ACTIVITY TAB ──────────────── */}
    {/* Aura: card with px-5 py-3, w-24 timestamp, w-32 agent name */}
    <TabsContent value="activity">
     <div className="mt-6">
      {activities.length === 0 ? (
       <EmptyState icon={Clock} text="No activity yet" sub="Events will appear as the project progresses." />
      ) : (
       <div className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
        {activities.map((a, i) => (
         <div
          key={i}
          className={`flex items-center gap-4 px-5 py-3 hover:bg-accent/40 transition-colors ${
           i < activities.length - 1 ?"border-b border-border/50" :""
          }`}
         >
          <span className="text-[12px] font-mono text-muted-foreground w-24 shrink-0">{a.time}</span>
          <span className="text-[14px] font-medium text-foreground/80 w-32 shrink-0 truncate">{a.agent}</span>
          <span className="text-[14px] text-muted-foreground flex-1">{a.event}</span>
         </div>
        ))}
       </div>
      )}
     </div>
    </TabsContent>
   </Tabs>
  </div>
 );
}

/* ──────────────── STRATEGY TAB COMPONENT ──────────────── */
function StrategyTab({ project, themes, projectId, navigate }) {
 const approvedThemes = themes.filter((t) => t.status === "approved");
 const pendingThemes = themes.filter((t) => t.status === "proposed");

 return (
  <div className="space-y-6">
   {/* North Star Metric — elevated card */}
   <div className="bg-card border border-border rounded-[2px] shadow-sm border-l-2 border-l-cyan-400">
    <div className="p-5">
     <div className="flex items-center gap-2 mb-2">
      <Target size={16} className="text-cyan-400" />
      <span className="text-[11px] uppercase tracking-[0.15em] font-mono text-muted-foreground">
       North Star Metric
      </span>
     </div>
     {project.nsm ? (
      <p className="text-[14px] font-medium text-foreground">{project.nsm}</p>
     ) : (
      <p className="text-[14px] text-muted-foreground/60">No NSM defined yet.</p>
     )}
     {project.mission && (
      <p className="text-[13px] text-muted-foreground mt-2">Mission: {project.mission}</p>
     )}
    </div>
   </div>

   {/* Pending theme proposals */}
   {pendingThemes.length > 0 && (
    <div className="bg-card border border-border rounded-[2px] shadow-sm">
     <div className="px-5 py-4 border-b border-border">
      <h2 className="text-[14px] font-medium text-foreground">Proposed Themes</h2>
     </div>
     <div className="divide-y divide-border">
      {pendingThemes.map((theme) => (
       <div key={theme.id} className="p-5">
        <div className="flex items-center gap-2 mb-2">
         <StatusBadge status="pending" />
         <span className="text-[14px] font-medium text-foreground">{theme.title}</span>
        </div>
        {theme.description && (
         <p className="text-[13px] text-muted-foreground mb-3">{theme.description}</p>
        )}
        <div className="space-y-1.5">
         {(theme.proxy_metrics || []).map((pm) => (
          <div key={pm.id} className="flex items-center gap-2 text-[13px]">
           <BarChart3 size={14} className="text-muted-foreground/50 shrink-0" />
           <span className="text-foreground/80">{pm.name}</span>
          </div>
         ))}
        </div>
        <p className="text-[11px] text-muted-foreground/50 mt-3">
         Proposed by {theme.proposed_by} — awaiting approval
        </p>
       </div>
      ))}
     </div>
    </div>
   )}

   {/* Approved themes */}
   {approvedThemes.length > 0 ? (
    <div className="bg-card border border-border rounded-[2px] shadow-sm">
     <div className="px-5 py-4 border-b border-border">
      <h2 className="text-[14px] font-medium text-foreground">Key Themes</h2>
     </div>
     <div className="divide-y divide-border">
      {approvedThemes.map((theme) => (
       <div key={theme.id} className="p-5">
        <div className="flex items-center gap-2 mb-1">
         <Compass size={16} className="text-teal-400 shrink-0" />
         <h4 className="text-[14px] font-medium text-foreground">{theme.title}</h4>
        </div>
        {theme.description && (
         <p className="text-[13px] text-muted-foreground mb-3 ml-[24px]">{theme.description}</p>
        )}
        <div className="space-y-2 ml-[24px]">
         {(theme.proxy_metrics || []).map((pm) => (
          <div key={pm.id} className="flex items-start gap-2">
           <BarChart3 size={14} className="text-muted-foreground/50 mt-0.5 shrink-0" />
           <div>
            <span className="text-[13px] font-medium text-foreground/80">{pm.name}</span>
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

/* ──────────────── COSTS TAB COMPONENT ──────────────── */
/* Aura: 4-col metric cards, budget progress card, breakdown table */
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
  return <EmptyState icon={DollarSign} text="No cost data yet" sub="Agents will log their token usage here." />;
 }

 return (
  <div className="space-y-6">
   {/* Metric cards — Aura: grid-cols-4 */}
   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
    <MetricCard label="Total Spend" value={`$${totalCost.toFixed(2)}`} mono icon={Wallet} />
    <MetricCard label="Weekly Budget" value={budget > 0 ? `$${budget}` :"No cap"} mono icon={DollarSign} />
    <MetricCard label="Burn Rate" value={dailyBurnRate > 0 ? `$${dailyBurnRate.toFixed(0)}/day` :"--"} mono />
    <MetricCard label="Utilization" value={budget > 0 ? `${utilizationPct}%` :"--"} />
   </div>

   {/* Budget utilization bar — Aura card */}
   {budget > 0 && (
    <div className="bg-card border border-border rounded-[2px] p-5 shadow-sm">
     <div className="flex justify-between items-end mb-3">
      <div>
       <h3 className="text-[14px] font-medium text-foreground mb-1">Budget Utilization</h3>
       <p className="text-[13px] text-muted-foreground">${totalCost.toFixed(2)} used of ${budget} total allocation</p>
      </div>
      <button
       onClick={onEditBudget}
       className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
       Edit Budget
      </button>
     </div>
     <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
      <div
       className={`h-full rounded-full ${utilizationPct > 80 ?"bg-amber-500" :"bg-emerald-500"}`}
       style={{ width: `${Math.min(utilizationPct, 100)}%` }}
      />
     </div>
     {exhaustionDate && (
      <p className="text-[13px] text-muted-foreground mt-3">
       Projected exhaustion: <span className="font-mono tabular-nums">{exhaustionDate}</span>
      </p>
     )}
     {budgetPolicy && (
      <div className="flex gap-4 text-[11px] text-muted-foreground/50 pt-3 mt-3 border-t border-border/50">
       <span>Warn: {Math.round((budgetPolicy.warn_threshold || 0.8) * 100)}%</span>
       <span>Stop: {Math.round((budgetPolicy.stop_threshold || 1.0) * 100)}%</span>
      </div>
     )}
    </div>
   )}

   {/* Per-agent breakdown — Aura table */}
   {(agentSummaries.length > 0 || costs.length > 0) && (
    <div className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
     <div className="px-5 py-4 border-b border-border">
      <h2 className="text-[14px] font-medium text-foreground">Cost Breakdown by Agent</h2>
     </div>
     <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse whitespace-nowrap">
       <thead>
        <tr>
         <th className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground pb-3 px-5 pt-4 border-b border-border font-normal w-[40%]">Agent</th>
         <th className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground pb-3 px-5 pt-4 border-b border-border font-normal w-[20%]">Total Cost</th>
         <th className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground pb-3 px-5 pt-4 border-b border-border font-normal w-[40%]">Percentage</th>
        </tr>
       </thead>
       <tbody>
        {(agentSummaries.length > 0 ? agentSummaries : costs).map((c, i, arr) => {
         const agentName = c.agent;
         const agentTotal = c.totalUsd ?? c.total_usd ?? 0;
         const pct = totalCost > 0 ? Math.round((agentTotal / totalCost) * 100) : 0;

         return (
          <tr key={agentName} className={`hover:bg-accent/40 transition-colors ${i < arr.length - 1 ?"border-b border-border/50" :""}`}>
           <td className="px-5 py-3.5 text-[14px] font-medium text-foreground">{agentName}</td>
           <td className="px-5 py-3.5 text-[14px] font-mono text-muted-foreground">${agentTotal.toFixed(2)}</td>
           <td className="px-5 py-3.5">
            <div className="flex items-center gap-3">
             <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
             </div>
             <span className="text-[11px] font-mono text-muted-foreground w-8 text-right">{pct}%</span>
            </div>
           </td>
          </tr>
         );
        })}
       </tbody>
      </table>
     </div>
    </div>
   )}

   {/* Cost timeline */}
   {entries.length > 0 && (
    <div className="bg-card border border-border rounded-[2px] shadow-sm">
     <div className="px-5 py-4 border-b border-border">
      <h2 className="text-[14px] font-medium text-foreground">Cost Timeline</h2>
     </div>
     <div className="p-5">
      <CostTimeline entries={entries.slice(0, 50)} />
     </div>
    </div>
   )}
  </div>
 );
}

/* ──────────────── APPROVALS TAB COMPONENT ──────────────── */
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
  return <EmptyState icon={ShieldCheck} text="No approvals" sub="All clear — no approvals for this project." />;
 }

 return (
  <div className="space-y-4">
   {pendingCount > 0 && (
    <p className="text-[13px] text-muted-foreground">{pendingCount} pending</p>
   )}
   <div className="bg-card border border-border rounded-[2px] shadow-sm overflow-hidden">
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

/* ──────────────── EXPERIMENTS TAB COMPONENT ──────────────── */
/* Aura: grid-cols-2 cards with hypothesis + metrics */
function ExperimentsTab({ experiments, themes = [], projectSlug, onRefresh }) {
 const [showCreate, setShowCreate] = useState(false);

 const totalRuns = experiments.reduce((sum, e) => sum + e.result_count, 0);
 const bestMetrics = experiments.map((e) => e.best_metric).filter((m) => m !== null && m !== undefined);
 const overallBest = bestMetrics.length > 0 ? Math.max(...bestMetrics) : null;

 return (
  <div className="space-y-6">
   {/* Header with create button */}
   <div className="flex justify-between items-center">
    <div />
    <button
     onClick={() => setShowCreate(!showCreate)}
     className="text-[13px] font-medium rounded-[6px] border border-border bg-secondary hover:bg-accent px-3 py-1.5 text-foreground transition-colors"
    >
     New Experiment
    </button>
   </div>

   {/* Create form */}
   {showCreate && (
    <CreateExperiment
     projectSlug={projectSlug}
     themes={themes}
     onCreated={() => { setShowCreate(false); onRefresh?.(); }}
     onClose={() => setShowCreate(false)}
    />
   )}

   {experiments.length === 0 && !showCreate ? (
    <EmptyState icon={FlaskConical} text="No experiments yet" sub="The lead can start one via the autoresearch protocol." />
   ) : experiments.length > 0 && (
    <>
     <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <MetricCard label="Experiments" value={experiments.length} />
      <MetricCard label="Total Runs" value={totalRuns} />
      {overallBest !== null && <MetricCard label="Best Metric" value={overallBest} mono />}
     </div>

     {/* Experiment cards — Aura: grid-cols-2, compact with hypothesis */}
     <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {experiments.map((exp) => (
       <div key={exp.dir} className="bg-[#121214] border border-zinc-800 rounded-sm shadow-sm p-5 flex flex-col h-full">
        <div className="flex justify-between items-start mb-3">
         <h3 className="text-sm font-medium text-zinc-100">{exp.name}</h3>
         <StatusBadge status={exp.status} />
        </div>
        {exp.hypothesis && (
         <p className="text-[13px] text-zinc-400 mb-4 flex-1 line-clamp-2">
          {exp.hypothesis}
         </p>
        )}
        {(exp.best_metric !== null || exp.result_count > 0) && (
         <div className="grid grid-cols-2 gap-4 border-t border-zinc-800/50 pt-4 mt-auto">
          {exp.best_metric !== null && (
           <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.15em] text-zinc-500 mb-1">Best Metric</div>
            <div className="text-sm font-medium font-mono text-zinc-200">{exp.best_metric}</div>
           </div>
          )}
          <div>
           <div className="text-[11px] font-mono uppercase tracking-[0.15em] text-zinc-500 mb-1">Runs</div>
           <div className="text-sm font-medium font-mono text-zinc-200">{exp.result_count}</div>
          </div>
         </div>
        )}
       </div>
      ))}
     </div>
    </>
   )}
  </div>
 );
}

/* ──────────────── DATA LOADERS ──────────────── */
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
