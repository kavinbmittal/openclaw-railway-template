import { useState, useEffect } from"react";
import { getFile, getProjectCosts, getBudgetPolicy, updateBudgetPolicy, getApprovals, resolveApproval, updateIssue, deleteIssue, getExperiments, getThemes, getIssues } from"../api.js";
import { formatDate as formatDateUtil, formatTimeAgo } from"../utils/formatDate.js";
import {
 ArrowLeft, FileText, Activity, DollarSign, Clock,
 User, Wallet, Target, ShieldCheck, Bot, CircleDot, Pencil, FlaskConical, Plus,
 Cpu, MessageSquare, TrendingUp,
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

const THEME_COLORS = [
 { badgeBg: "bg-indigo-500/10", badgeBorder: "border-indigo-500/20", text: "text-indigo-400" },
 { badgeBg: "bg-emerald-500/10", badgeBorder: "border-emerald-500/20", text: "text-emerald-400" },
 { badgeBg: "bg-amber-500/10", badgeBorder: "border-amber-500/20", text: "text-amber-400" },
 { badgeBg: "bg-cyan-500/10", badgeBorder: "border-cyan-500/20", text: "text-cyan-400" },
 { badgeBg: "bg-rose-500/10", badgeBorder: "border-rose-500/20", text: "text-rose-400" },
];

const TABS = [
 { id:"overview", label:"Overview", icon: FileText },
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
 const workdirMatch = raw.match(/\*\*Workdir:\*\*\s*(.+)/);
 const subagentsMatch = raw.match(/## Sub-agents\n+([\s\S]*?)(?=\n## |$)/);
 return {
  title: titleMatch?.[1] ||"",
  lead: leadMatch?.[1] ||"unassigned",
  budget: budgetMatch?.[1]?.trim() ||"none",
  status: statusMatch?.[1] ||"unknown",
  created: createdMatch?.[1] ||"",
  nsm: nsmMatch?.[1]?.trim() || null,
  workdir: workdirMatch?.[1]?.trim() || null,
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
   getFile(`shared/projects/${projectId}/activity.log`).catch(() => null),
   loadStandups(projectId),
   loadCosts(projectId),
   getProjectCosts(projectId).catch(() => null),
   getBudgetPolicy(projectId).catch(() => null),
   getApprovals(projectId).catch(() => []),
   getExperiments(projectId).catch(() => []),
   getThemes(projectId).catch(() => []),
  ]).then(([proj, activity, standupList, costList, costData, policyData, approvalList, experimentList, themeList]) => {
   setProjectRaw(proj?.content || null);
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
   <div className="p-8 max-w-[1400px] mx-auto w-full animate-pulse transition-opacity duration-300">
    {/* Header Skeleton */}
    <div className="space-y-4">
     <div className="h-4 w-48 bg-zinc-800/50 rounded-[4px]"></div>
     <div>
      <div className="flex items-center gap-4">
       <div className="h-9 w-64 bg-zinc-800/60 rounded-[4px]"></div>
       <div className="h-6 w-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full"></div>
      </div>
      <div className="flex items-center gap-3 mt-4">
       <div className="h-4 w-16 bg-zinc-800/50 rounded-[4px]"></div>
       <div className="h-1 w-1 bg-zinc-700 rounded-full"></div>
       <div className="h-4 w-16 bg-zinc-800/50 rounded-[4px]"></div>
       <div className="h-1 w-1 bg-zinc-700 rounded-full"></div>
       <div className="h-4 w-24 bg-zinc-800/50 rounded-[4px]"></div>
      </div>
     </div>
    </div>

    {/* Tabs Skeleton */}
    <div className="flex gap-8 mt-8 border-b border-border pb-3">
     <div className="h-5 w-24 bg-zinc-800/60 rounded-[4px]"></div>
     <div className="h-5 w-20 bg-zinc-800/40 rounded-[4px]"></div>
     <div className="h-5 w-28 bg-zinc-800/40 rounded-[4px]"></div>
     <div className="h-5 w-24 bg-zinc-800/40 rounded-[4px]"></div>
    </div>

    {/* Content Skeleton */}
    <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6 pb-12">
     {/* Left Column Skeleton */}
     <div className="xl:col-span-2 space-y-6">
      <div className="h-32 bg-card border border-border/60 rounded-[2px] p-[20px] flex flex-col justify-between">
       <div className="h-4 w-20 bg-zinc-800/60 rounded-[4px]"></div>
       <div className="space-y-2.5">
        <div className="h-3 w-full bg-zinc-800/40 rounded-[4px]"></div>
        <div className="h-3 w-3/4 bg-zinc-800/40 rounded-[4px]"></div>
       </div>
      </div>
      <div className="h-32 bg-card border border-border/60 rounded-[2px] p-[20px] flex flex-col justify-between">
       <div className="h-4 w-40 bg-zinc-800/60 rounded-[4px]"></div>
       <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-zinc-800/50"></div>
        <div className="space-y-2.5 flex-1">
         <div className="h-6 w-48 bg-zinc-800/60 rounded-[4px]"></div>
         <div className="h-3 w-64 bg-zinc-800/40 rounded-[4px]"></div>
        </div>
       </div>
      </div>
      <div className="h-[400px] bg-card border border-border/60 rounded-[2px]"></div>
     </div>
     {/* Right Column Skeleton */}
     <div className="space-y-6">
      <div className="h-48 bg-card border border-border/60 rounded-[2px] p-[20px] flex flex-col gap-4">
       <div className="h-4 w-20 bg-zinc-800/60 rounded-[4px] mb-2"></div>
       <div className="flex justify-between"><div className="h-3 w-16 bg-zinc-800/40 rounded-[4px]"></div><div className="h-3 w-24 bg-zinc-800/60 rounded-[4px]"></div></div>
       <div className="flex justify-between"><div className="h-3 w-12 bg-zinc-800/40 rounded-[4px]"></div><div className="h-3 w-20 bg-zinc-800/60 rounded-[4px]"></div></div>
       <div className="flex justify-between"><div className="h-3 w-14 bg-zinc-800/40 rounded-[4px]"></div><div className="h-3 w-16 bg-zinc-800/60 rounded-[4px]"></div></div>
       <div className="flex justify-between"><div className="h-3 w-20 bg-zinc-800/40 rounded-[4px]"></div><div className="h-3 w-24 bg-zinc-800/60 rounded-[4px]"></div></div>
      </div>
      <div className="h-64 bg-card border border-border/60 rounded-[2px] p-[20px] flex flex-col gap-3">
       <div className="h-4 w-24 bg-zinc-800/60 rounded-[4px] mb-2"></div>
       <div className="h-10 bg-zinc-800/40 rounded-[4px]"></div>
       <div className="h-10 bg-zinc-800/40 rounded-[4px]"></div>
       <div className="h-10 bg-zinc-800/40 rounded-[4px]"></div>
      </div>
     </div>
    </div>
   </div>
  );
 }

 return (
  <div className="flex flex-col h-full">
   <header className="px-8 py-8 border-b border-border shrink-0 bg-background">
    {/* Breadcrumb */}
    <nav className="flex items-center text-[15px] text-zinc-400 mb-5 tracking-wide">
     <a href="#/overview" onClick={(e) => { e.preventDefault(); navigate("overview"); }} className="hover:text-zinc-200 transition-colors cursor-pointer">Projects</a>
     <span className="mx-2 text-zinc-600">&rsaquo;</span>
     <span className="text-zinc-100 font-semibold">{project.title || projectId}</span>
    </nav>

    {/* Title + Status Badge + Edit */}
    <div className="flex items-center gap-4 mb-4">
     <h1 className="text-[30px] font-semibold text-zinc-100 leading-none tracking-tight">
      {project.title || projectId}
     </h1>
     <StatusBadge status={project.status} />
     <button
      onClick={() => navigate("edit-project", projectId)}
      className="ml-auto px-3 py-1.5 rounded-[6px] border border-border bg-card text-[14px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex items-center gap-1.5"
     >
      <Pencil size={13} />
      Edit
     </button>
    </div>

    {/* Metadata */}
    <div className="flex items-center gap-2 text-[15px] text-zinc-500">
     <span
      className="hover:text-zinc-200 transition-colors cursor-pointer capitalize"
      onClick={() => {
       const name = project.lead.toLowerCase();
       const workspaceId = name ==="sam" ?"workspace" : `workspace-${name}`;
       navigate("agent-detail", workspaceId);
      }}
     >
      {project.lead}
     </span>
     <span className="text-zinc-600">&middot;</span>
     <span className="font-mono tabular-nums">{project.budget}</span>
     {project.created && (
      <>
       <span className="text-zinc-600">&middot;</span>
       <span>{formatDateUtil(project.created)}</span>
      </>
     )}
     {totalCost > 0 && (
      <>
       <span className="text-zinc-600">&middot;</span>
       <span className="font-mono tabular-nums">${totalCost.toFixed(2)} spent</span>
      </>
     )}
    </div>
   </header>

   <div className="flex-1 overflow-y-auto p-8">
   <div className="max-w-[1400px] mx-auto">
   {/* Tabs — Aura: border-b, gap-8 */}
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
         <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400 text-[11px] font-medium px-1">
          {pendingCount}
         </span>
        )}
       </TabsTrigger>
      );
     })}
    </TabsList>

    {/* ──────────────── OVERVIEW TAB ──────────────── */}
    <TabsContent value="overview">
     {(() => {
      const approvedThemes = themes.filter((t) => t.status === "approved").sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      return (
       <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        {/* Left column */}
        <div className="xl:col-span-2 space-y-6">
         {/* Mission */}
         <div className="bg-card border border-border rounded-[2px] shadow-sm">
          <div className="flex items-center gap-3 px-5 py-3 bg-indigo-500/[0.02] transition-colors">
           <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Target className="w-3.5 h-3.5 text-indigo-400" />
           </div>
           <div className="text-[15px] font-medium text-indigo-100">Mission</div>
          </div>
          <div className="p-[20px] text-[14px] text-zinc-300 space-y-4">
           <p>{project.mission || "No mission defined."}</p>
          </div>
         </div>

         {/* NSM */}
         <div className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 px-5 py-3 bg-indigo-500/[0.02] transition-colors">
           <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Target className="w-3.5 h-3.5 text-indigo-400" />
           </div>
           <div className="text-[15px] font-medium text-indigo-100">North Star Metric (NSM)</div>
          </div>
          <div className="p-[20px] flex items-center gap-4">
           <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Target size={24} />
           </div>
           <div>
            <div className="text-2xl font-semibold text-white tracking-tight">{project.nsm || "Not set"}</div>
            {project.mission && <div className="text-[14px] text-zinc-400 mt-1">{project.mission}</div>}
           </div>
          </div>
         </div>

         {/* Themes */}
         <div className="bg-card border border-border rounded-[2px] shadow-sm">
          <div className="flex items-center gap-3 px-5 py-3 bg-indigo-500/[0.02] transition-colors">
           <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
           </div>
           <div className="text-[15px] font-medium text-indigo-100">Themes</div>
          </div>
          <div className="flex flex-col">
           {approvedThemes.map((theme, idx, arr) => {
            const colors = THEME_COLORS[idx % THEME_COLORS.length];
            return (
             <div key={theme.id} className={`px-5 py-4 ${idx < arr.length - 1 ? "border-b border-border/50" : ""}`}>
              <div className="flex items-center gap-3 mb-1.5">
               <div className={`w-6 h-6 rounded-full ${colors.badgeBg} border ${colors.badgeBorder} flex items-center justify-center text-[12px] font-mono font-medium ${colors.text} flex-shrink-0`}>
                {theme.order ?? idx + 1}
               </div>
               <h3 className="text-[15px] font-medium text-zinc-200">{theme.title}</h3>
              </div>
              {theme.description && (
               <p className="text-[12px] text-zinc-500 ml-9 mb-3">{theme.description}</p>
              )}
              <div className="ml-9 space-y-2.5">
               {(theme.proxy_metrics || []).sort((a, b) => (a.order ?? 999) - (b.order ?? 999)).map((pm, pmIdx) => (
                <div key={pm.id} className="flex items-start gap-3 text-[14px] text-zinc-400">
                 <div className="w-4 h-4 rounded bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center text-[11px] font-mono text-zinc-500 flex-shrink-0 mt-0.5">
                  {String.fromCharCode(97 + pmIdx)}
                 </div>
                 <span>{pm.name}{pm.target && <span className="text-zinc-500 font-mono text-[12px] ml-2">→ {pm.target}</span>}</span>
                </div>
               ))}
              </div>
             </div>
            );
           })}
          </div>
         </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
         {/* Details */}
         <div className="bg-card border border-border rounded-[2px] shadow-sm">
          <div className="px-5 py-4 border-b border-border">
           <h2 className="text-[14px] font-medium text-zinc-100">Details</h2>
          </div>
          <div className="p-[20px] flex flex-col gap-4">
           <div className="flex justify-between items-center">
            <span className="text-[12px] font-mono uppercase tracking-widest text-zinc-500">Status</span>
            <span className="text-[14px] text-zinc-200 capitalize">{project.status || "Unknown"}</span>
           </div>
           <div className="flex justify-between items-center">
            <span className="text-[12px] font-mono uppercase tracking-widest text-zinc-500">Lead</span>
            <a href={`#/agents/workspace-${(project.lead || "").toLowerCase()}`} className="text-[14px] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-2">
             <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[12px] font-medium text-indigo-300">
              {(project.lead || "?")[0].toUpperCase()}
             </div>
             {project.lead || "Unassigned"}
            </a>
           </div>
           <div className="flex justify-between items-center">
            <span className="text-[12px] font-mono uppercase tracking-widest text-zinc-500">Budget</span>
            <span className="text-[14px] text-zinc-200">{project.budget || "None"}</span>
           </div>
           <div className="flex justify-between items-center">
            <span className="text-[12px] font-mono uppercase tracking-widest text-zinc-500">Created</span>
            <span className="text-[14px] text-zinc-200">{project.created || "—"}</span>
           </div>
           {project.workdir && (
            <div className="flex justify-between items-center">
             <span className="text-[12px] font-mono uppercase tracking-widest text-zinc-500">Workdir</span>
             <span className="text-[14px] text-zinc-200 font-mono truncate max-w-[200px]" title={project.workdir}>{project.workdir}</span>
            </div>
           )}
          </div>
         </div>

         {/* Sub-agents */}
         {project.subagents && !project.subagents.includes("(none") && (
          <div className="bg-card border border-border rounded-[2px] shadow-sm">
           <div className="flex items-center gap-3 px-5 py-3 bg-cyan-500/[0.02] transition-colors">
            <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
             <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-[15px] font-medium text-cyan-100">Sub-agents</div>
           </div>
           <div className="p-[20px]">
            <Markdown content={project.subagents} />
           </div>
          </div>
         )}

         {/* Approval Gates */}
         {project.gates && (
          <div className="bg-card border border-border rounded-[2px] shadow-sm">
           <div className="flex items-center gap-3 px-5 py-3 bg-amber-500/[0.02] transition-colors">
            <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
             <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-[15px] font-medium text-amber-100">Approval Gates</div>
           </div>
           <div className="p-[20px] text-[14px] text-zinc-400 space-y-3">
            {project.gates
             .split("\n")
             .filter(Boolean)
             .map((gate, i) => {
              const text = gate.replace(/^-\s*/,"");
              const [name] = text.split(":").map((s) => s.trim());
              return (
               <div key={i} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-[4px] border border-zinc-600 flex items-center justify-center" />
                <span className="text-zinc-300">{name}</span>
               </div>
              );
             })}
           </div>
          </div>
         )}
        </div>
       </div>
      );
     })()}
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
      <ExperimentsTab experiments={experiments} themes={themes.filter((t) => t.status === "approved")} projectSlug={projectId} onRefresh={() => getExperiments(projectId).then(setExperiments)} navigate={navigate} />
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
           <div className="flex items-center gap-3 px-5 py-3 bg-emerald-500/[0.02] transition-colors">
            <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
             <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-[15px] font-medium text-emerald-100">{displayDate}</div>
           </div>
           <div className="p-[20px]">
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
       themes={themes.filter((t) => t.status === "approved")}
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
   </div>
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
    <div className="bg-card border border-border rounded-[2px] p-[20px] shadow-sm">
     <div className="flex justify-between items-end mb-3">
      <div>
       <h3 className="text-[14px] font-medium text-foreground mb-1">Budget Utilization</h3>
       <p className="text-[15px] text-muted-foreground">${totalCost.toFixed(2)} used of ${budget} total allocation</p>
      </div>
      <button
       onClick={onEditBudget}
       className="text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors"
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
      <p className="text-[15px] text-muted-foreground mt-3">
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
     <div className="flex items-center gap-3 px-5 py-3 bg-amber-500/[0.02] transition-colors">
      <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
       <Wallet className="w-3.5 h-3.5 text-amber-400" />
      </div>
      <div className="text-[15px] font-medium text-amber-100">Cost Breakdown by Agent</div>
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
     <div className="flex items-center gap-3 px-5 py-3 bg-amber-500/[0.02] transition-colors">
      <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
       <Clock className="w-3.5 h-3.5 text-amber-400" />
      </div>
      <div className="text-[15px] font-medium text-amber-100">Cost Timeline</div>
     </div>
     <div className="p-[20px]">
      <CostTimeline entries={entries.slice(0, 50)} />
     </div>
    </div>
   )}
  </div>
 );
}

/* ──────────────── APPROVALS TAB COMPONENT ──────────────── */
function ProjectApprovalsTab({ approvals, projectId, onResolved, navigate, themes = [] }) {
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

 // Find theme data for an approval
 function getApprovalThemeData(approval) {
  const allThemes = themes || [];
  const expTheme = allThemes.find((t) => t.id === approval.theme || t.title === approval.theme || t.id === approval.theme_id || t.title === approval.theme_title);
  if (!expTheme) return null;
  const sortedThemes = allThemes.filter((t) => t.status === "approved").sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const themeIdx = sortedThemes.indexOf(expTheme);
  const themeColors = THEME_COLORS[themeIdx >= 0 ? themeIdx % THEME_COLORS.length : 0];
  const sortedPms = (expTheme.proxy_metrics || []).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const proxyMetric = sortedPms.find((pm) =>
   pm.id === approval.proxy_metric || pm.name === approval.proxy_metric ||
   (approval.proxy_metrics && approval.proxy_metrics.some((apm) => (apm.id || apm) === pm.id || apm.name === pm.name)) ||
   (approval.proxy_metric_names && approval.proxy_metric_names.some((n) => n === pm.name || n === pm.id))
  );
  const pmIdx = proxyMetric ? sortedPms.indexOf(proxyMetric) : -1;
  return { expTheme, themeIdx, themeColors, proxyMetric, pmIdx };
 }

 return (
  <div className="space-y-4">
   {pendingCount > 0 && (
    <p className="text-[15px] text-muted-foreground">{pendingCount} pending</p>
   )}
   {approvals.map((approval) => {
    const isPending = !approval.status || approval.status === "pending" || approval.status === "proposed";
    const isRejected = approval.status === "rejected";
    const title = approval.what || approval.title || "";
    const itemType = approval.type || approval.gate || null;
    const timeAgo = approval.created ? formatTimeAgo(approval.created) : approval.timestamp ? formatTimeAgo(approval.timestamp) : "";
    const td = getApprovalThemeData(approval);

    // Type badge config
    const typeBadges = {
     "proposed-issue": { label: "Issue", cls: "border-violet-500/20 bg-violet-500/10 text-violet-400" },
     "experiment-start": { label: "Experiment", cls: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400" },
     "autoresearch-start": { label: "Experiment", cls: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400" },
     "proposed-theme": { label: "Theme", cls: "border-teal-500/20 bg-teal-500/10 text-teal-400" },
     theme: { label: "Theme", cls: "border-teal-500/20 bg-teal-500/10 text-teal-400" },
     "deliverable-review": { label: "Deliverable", cls: "border-blue-500/20 bg-blue-500/10 text-blue-400" },
    };
    const badge = typeBadges[itemType] || (itemType ? { label: itemType, cls: "border-amber-500/20 bg-amber-500/10 text-amber-400" } : null);

    return (
     <div
      key={approval.id || approval._file}
      className={`bg-card border border-border rounded-[2px] p-[20px] flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-sm ${isRejected ? "opacity-60" : ""}`}
      onClick={() => navigate && navigate("approval-detail", approval.id)}
     >
      <div className="space-y-2.5 cursor-pointer">
       {badge && (
        <div>
         <span className={`px-2.5 py-0.5 rounded-full text-[12px] font-medium border ${badge.cls}`}>{badge.label}</span>
        </div>
       )}
       <p className={`text-[15px] font-medium text-zinc-100 ${isRejected ? "line-through decoration-zinc-500" : ""}`}>{title}</p>

       {/* Theme + Proxy Metric pill row */}
       {td && (
        <div className="flex flex-wrap items-center gap-2">
         <div className="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-zinc-800/40 border border-zinc-700/30">
          <div className={`w-3.5 h-3.5 rounded-full ${td.themeColors.badgeBg} border ${td.themeColors.badgeBorder} flex items-center justify-center text-[9px] font-mono font-medium ${td.themeColors.text} flex-shrink-0`}>
           {td.expTheme.order ?? td.themeIdx + 1}
          </div>
          <span className="text-[12px] text-zinc-300">{td.expTheme.title}</span>
         </div>
         {td.proxyMetric && (
          <>
           <span className="text-zinc-600 text-[14px]">{"\u203A"}</span>
           <div className="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-zinc-800/40 border border-zinc-700/30">
            <div className="w-3.5 h-3.5 rounded bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center text-[9px] font-mono text-zinc-500 flex-shrink-0">
             {String.fromCharCode(97 + (td.pmIdx >= 0 ? td.pmIdx : 0))}
            </div>
            <span className="text-[12px] text-zinc-400">{td.proxyMetric.name}</span>
           </div>
          </>
         )}
        </div>
       )}

       <div className="text-[12px] text-zinc-500 flex items-center gap-2 pt-0.5">
        {approval.requester && <span>Requested by: {approval.requester}</span>}
        {approval.requester && timeAgo && <span>&middot;</span>}
        {timeAgo && <span>{timeAgo}</span>}
       </div>

       {/* Rejection comment */}
       {isRejected && approval.comment && (
        <div className="text-[12px] text-red-400 flex items-center gap-1.5 mt-2 bg-red-500/10 px-3 py-1.5 rounded-[4px] border border-red-500/20 inline-flex w-fit">
         Rejected: {approval.comment}
        </div>
       )}
      </div>

      {/* Right: action buttons */}
      {isPending && (
       <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
         onClick={() => handleReject(approval)}
         className="px-4 py-1.5 rounded-[6px] border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-[color,box-shadow] text-[14px] font-medium focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-red-500/30"
        >
         Reject
        </button>
        <button
         onClick={() => handleApprove(approval)}
         className="px-4 py-1.5 rounded-[6px] border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-[color,box-shadow] text-[14px] font-medium focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-emerald-500/30"
        >
         Approve
        </button>
       </div>
      )}
     </div>
    );
   })}
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
function ExperimentsTab({ experiments, themes = [], projectSlug, onRefresh, navigate }) {
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
     className="rounded-[6px] border border-border bg-card text-[15px] font-medium text-zinc-300 px-3 py-1.5 hover:bg-zinc-800 transition-[color,box-shadow] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
     <button
      onClick={() => setShowCreate(true)}
      className="border border-dashed border-border hover:border-zinc-700 hover:bg-zinc-800/20 transition-[color,box-shadow] rounded-[2px] p-[20px] flex flex-col items-center justify-center text-zinc-500 hover:text-zinc-400 min-h-[160px] h-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:col-span-2"
     >
      <Plus size={24} className="mb-2" />
      <span className="text-[14px] font-medium">Propose New Experiment</span>
     </button>
    </div>
   ) : experiments.length > 0 && (
    <>
     <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <MetricCard label="Experiments" value={experiments.length} />
      <MetricCard label="Total Runs" value={totalRuns} />
      {overallBest !== null && <MetricCard label="Best Metric" value={overallBest} mono />}
     </div>

     {/* Experiment cards — Aura: grid-cols-2, compact with hypothesis */}
     <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {experiments.map((exp) => {
       const expTheme = themes.find((t) => t.id === exp.theme || t.title === exp.theme);
       const themeIdx = expTheme ? themes.filter((t) => t.status === "approved").sort((a, b) => (a.order ?? 999) - (b.order ?? 999)).indexOf(expTheme) : -1;
       const themeColors = themeIdx >= 0 ? THEME_COLORS[themeIdx % THEME_COLORS.length] : null;
       const proxyMetric = expTheme?.proxy_metrics?.find((pm) => pm.id === exp.proxy_metric || pm.name === exp.proxy_metric);
       const pmIdx = proxyMetric && expTheme?.proxy_metrics ? expTheme.proxy_metrics.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)).indexOf(proxyMetric) : -1;

       return (
       <div key={exp.dir} onClick={() => navigate("experiment-detail", { slug: projectSlug, dir: exp.dir })} className="bg-card border border-border rounded-[2px] shadow-sm p-[20px] flex flex-col h-full gap-4 cursor-pointer hover:bg-zinc-800/30 transition-colors">
        <div className="space-y-2.5">
         {exp.status && exp.status !== "unknown" && (
          <div>
           <StatusBadge status={exp.status} />
          </div>
         )}
         <h3 className="text-[15px] font-medium text-zinc-100">{exp.name}</h3>

         {/* Theme + Proxy Metric pill row */}
         {expTheme && (
          <div className="flex flex-wrap items-center gap-2">
           <div className="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-zinc-800/40 border border-zinc-700/30">
            <div className={`w-3.5 h-3.5 rounded-full ${themeColors?.badgeBg || "bg-zinc-800/50"} border ${themeColors?.badgeBorder || "border-zinc-700/50"} flex items-center justify-center text-[9px] font-mono font-medium ${themeColors?.text || "text-zinc-500"} flex-shrink-0`}>
             {expTheme.order ?? themeIdx + 1}
            </div>
            <span className="text-[12px] text-zinc-300">{expTheme.title}</span>
           </div>
           {proxyMetric && (
            <>
             <span className="text-zinc-600 text-[14px]">{"\u203A"}</span>
             <div className="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-zinc-800/40 border border-zinc-700/30">
              <div className="w-3.5 h-3.5 rounded bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center text-[9px] font-mono text-zinc-500 flex-shrink-0">
               {String.fromCharCode(97 + (pmIdx >= 0 ? pmIdx : 0))}
              </div>
              <span className="text-[12px] text-zinc-400">{proxyMetric.name}</span>
             </div>
            </>
           )}
          </div>
         )}
        </div>

        {exp.hypothesis && (
         <p className="text-[14px] text-zinc-400 flex-1">
          Hypothesis: {exp.hypothesis}
         </p>
        )}
        <div className="grid grid-cols-2 gap-4 border-t border-border/50 pt-4 mt-auto">
         {exp.proxy_metric && (
          <div>
           <div className="text-[12px] font-mono uppercase tracking-widest text-zinc-500 mb-1">{proxyMetric?.name || exp.proxy_metric}</div>
           <div className={`text-[14px] font-medium ${exp.best_metric !== null ? "text-emerald-400" : "text-zinc-400"}`}>
            {exp.best_metric !== null ? exp.best_metric : "\u2014"}
           </div>
          </div>
         )}
         <div>
          <div className="text-[12px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Runs</div>
          <div className="text-[14px] font-medium text-zinc-200">{exp.result_count}</div>
         </div>
        </div>
       </div>
       );
      })}
      {/* Propose New Experiment card */}
      <button
       onClick={() => setShowCreate(true)}
       className="border border-dashed border-border hover:border-zinc-700 hover:bg-zinc-800/20 transition-[color,box-shadow] rounded-[2px] p-[20px] flex flex-col items-center justify-center text-zinc-500 hover:text-zinc-400 min-h-[160px] h-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:col-span-2"
      >
       <Plus size={24} className="mb-2" />
       <span className="text-[14px] font-medium">Propose New Experiment</span>
      </button>
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
