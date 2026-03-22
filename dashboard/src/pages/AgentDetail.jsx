import { useState, useEffect } from"react";
import { getAgent, getAgentActivity, getAgentRuns, getModelRouting } from"../api.js";
import { AgentHeader } from"../components/AgentHeader.jsx";
import { TaskList } from"../components/TaskList.jsx";
import { RunHistory } from"../components/RunHistory.jsx";
import { DailyLog } from"../components/DailyLog.jsx";
import Markdown from"../components/Markdown.jsx";
import { Skeleton } from"../components/ui/Skeleton.jsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from"../components/ui/Tabs.jsx";
import { EmptyState } from"../components/EmptyState.jsx";
import {
 FileText,
 ListTodo,
 Clock,
 Play,
 Bot,
 Briefcase,
 Brain,
} from"lucide-react";

const TABS = [
 { id:"overview", label:"Overview", icon: FileText },
 { id:"tasks", label:"Tasks", icon: ListTodo },
 { id:"activity", label:"Activity", icon: Clock },
 { id:"runs", label:"Runs", icon: Play },
];

export default function AgentDetail({ agentId, navigate }) {
 const [agent, setAgent] = useState(null);
 const [activity, setActivity] = useState(null);
 const [runs, setRuns] = useState(null);
 const [loading, setLoading] = useState(true);
 const [tab, setTab] = useState("overview");
 const [tierInfo, setTierInfo] = useState(null);

 useEffect(() => {
  setLoading(true);
  Promise.all([
   getAgent(agentId),
   getModelRouting().catch(() => ({ exists: false, config: null })),
  ])
   .then(([data, routingData]) => {
    setAgent(data);
    if (routingData.exists && routingData.config) {
     const cfg = routingData.config;
     const tierName = cfg.agents[agentId];
     if (tierName && cfg.tiers[tierName]) {
      const tier = cfg.tiers[tierName];
      const modelShort = tier.model?.split("/")[1]?.replace("claude-", "") || tier.model;
      const thinkingLabel = tier.thinking && tier.thinking !== "off" ? ` (${tier.thinking})` : "";
      setTierInfo({ name: tierName, display: `${modelShort}${thinkingLabel}` });
     }
    }
    setLoading(false);
   })
   .catch(() => setLoading(false));
 }, [agentId]);

 // Lazy load activity and runs when tabs are selected
 useEffect(() => {
  if (tab ==="activity" && !activity) {
   getAgentActivity(agentId)
    .then(setActivity)
    .catch(() => setActivity({ days: [], activityEntries: [] }));
  }
  if (tab ==="runs" && !runs) {
   getAgentRuns(agentId)
    .then(setRuns)
    .catch(() => setRuns([]));
  }
 }, [tab, agentId, activity, runs]);

 if (loading) {
  return (
   <div className="space-y-4">
    <Skeleton className="h-6 w-48" />
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-32 w-full" />
   </div>
  );
 }

 if (!agent) {
  return (
   <EmptyState
    icon={Bot}
    text="Agent not found"
    sub={`No workspace found for"${agentId}"`}
    action="Back to Agents"
    onAction={() => navigate("agents")}
   />
  );
 }

 const statusDot = agent.status === "active" ? "bg-emerald-500" : "bg-gray-500";

 return (
  <div className="flex flex-col h-full">
   <header className="px-8 py-8 border-b border-border shrink-0 bg-background">
    {/* Breadcrumb */}
    <nav className="flex items-center text-[15px] text-zinc-400 mb-5 tracking-wide">
     <a href="#/agents" onClick={(e) => { e.preventDefault(); navigate("agents"); }} className="hover:text-zinc-200 transition-colors cursor-pointer">Agents</a>
     <span className="mx-2 text-zinc-600">&rsaquo;</span>
     <span className="text-zinc-100 font-semibold">{agent.name}</span>
    </nav>

    {/* Title + Status */}
    <div className="flex items-center gap-4 mb-4">
     <div className="flex items-center justify-center h-12 w-12 bg-zinc-800/50 border border-border text-2xl shrink-0">
      {agent.emoji || agent.name?.charAt(0)?.toUpperCase()}
     </div>
     <h1 className="text-[30px] font-semibold text-zinc-100 leading-none tracking-tight">{agent.name}</h1>
     {tierInfo && (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shrink-0">
       {tierInfo.name} · {tierInfo.display}
      </span>
     )}
     <span className="relative flex h-2.5 w-2.5 shrink-0">
      {agent.status === "active" ? (
       <>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusDot}`} />
       </>
      ) : (
       <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusDot}`} />
      )}
     </span>
    </div>

    {/* Metadata */}
    <div className="flex items-center gap-2 text-[15px] text-zinc-500">
     {agent.role && <span>{agent.role}</span>}
     {agent.lastSeen && (
      <>
       {agent.role && <span className="text-zinc-600">&middot;</span>}
       <span className="font-mono tabular-nums">Last seen {agent.lastSeen}</span>
      </>
     )}
     {agent.runCount != null && (
      <>
       <span className="text-zinc-600">&middot;</span>
       <span>{agent.runCount} runs</span>
      </>
     )}
    </div>
   </header>

   <div className="flex-1 overflow-y-auto p-8">
   <div className="space-y-6">

   <Tabs value={tab} onValueChange={setTab}>
    <TabsList>
     {TABS.map(({ id, label, icon: Icon }) => (
      <TabsTrigger key={id} value={id}>
       <Icon size={14} strokeWidth={1.8} />
       {label}
      </TabsTrigger>
     ))}
    </TabsList>

    {/* Overview tab */}
    <TabsContent value="overview">
     <div className="space-y-4">
      {/* Current work */}
      {agent.inProgress && agent.inProgress.length > 0 && (
       <div className="border border-border border-l-2 border-l-cyan-500 bg-accent/20 p-4">
        <div className="flex items-center gap-2 mb-3">
         <Briefcase size={14} className="text-cyan-400" />
         <h3 className="text-[14px] font-semibold text-muted-foreground">
          Current Work
         </h3>
        </div>
        <div className="space-y-1.5">
         {agent.inProgress.map((task, i) => (
          <div key={i} className="flex items-start gap-2 text-[14px]">
           <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-cyan-400" />
           <span className="text-foreground/80">{task}</span>
          </div>
         ))}
        </div>
       </div>
      )}

      {/* Waiting on */}
      {agent.waitingOn && agent.waitingOn.length > 0 && (
       <div className="bg-card rounded-[2px] border border-border shadow-sm p-[20px]">
        <div className="flex items-center gap-2 mb-3">
         <Clock size={14} className="text-amber-400" />
         <h3 className="text-[14px] font-semibold text-muted-foreground">
          Waiting On
         </h3>
        </div>
        <div className="space-y-1.5">
         {agent.waitingOn.map((task, i) => (
          <div key={i} className="flex items-start gap-2 text-[14px]">
           <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-amber-400" />
           <span className="text-foreground/80">{task}</span>
          </div>
         ))}
        </div>
       </div>
      )}

      {/* Projects */}
      {agent.projects && agent.projects.length > 0 && (
       <div className="bg-card rounded-[2px] border border-border shadow-sm p-[20px]">
        <div className="flex items-center gap-2 mb-3">
         <Briefcase size={14} className="text-muted-foreground/50" />
         <h3 className="text-[14px] font-semibold text-muted-foreground">
          Projects
         </h3>
        </div>
        <div className="space-y-1">
         {agent.projects.map((p) => (
          <button
           key={p.id}
           onClick={() => navigate("project", p.id)}
           className="flex items-center gap-2 text-[14px] text-foreground/80 hover:text-foreground transition-colors w-full text-left py-1"
          >
           <span className="w-3 h-3 rounded-[2px] bg-primary/30 shrink-0" />
           {p.title}
          </button>
         ))}
        </div>
       </div>
      )}

      {/* SOUL summary */}
      {agent.soulSummary && (
       <div className="bg-card rounded-[2px] border border-border shadow-sm p-[20px]">
        <div className="flex items-center gap-2 mb-3">
         <Brain size={14} className="text-muted-foreground/50" />
         <h3 className="text-[14px] font-semibold text-muted-foreground">
          Identity
         </h3>
        </div>
        <p className="text-[14px] text-foreground/70 leading-relaxed whitespace-pre-line">
         {agent.soulSummary}
        </p>
       </div>
      )}

      {/* Idle state */}
      {agent.status ==="idle" && (!agent.inProgress || agent.inProgress.length === 0) && (
       <div className="bg-card rounded-[2px] border border-border shadow-sm p-[20px] text-center">
        <p className="text-[14px] text-muted-foreground/60">
         {agent.name} is currently idle with no active tasks.
        </p>
       </div>
      )}
     </div>
    </TabsContent>

    {/* Tasks tab */}
    <TabsContent value="tasks">
     <TaskList tasksRaw={agent.tasksRaw} />
    </TabsContent>

    {/* Activity tab */}
    <TabsContent value="activity">
     {activity ? (
      <DailyLog days={activity.days} activityEntries={activity.activityEntries} />
     ) : (
      <div className="space-y-2">
       <Skeleton className="h-24 w-full" />
       <Skeleton className="h-24 w-full" />
      </div>
     )}
    </TabsContent>

    {/* Runs tab */}
    <TabsContent value="runs">
     {runs ? (
      <RunHistory runs={runs} />
     ) : (
      <div className="space-y-2">
       <Skeleton className="h-24 w-full" />
       <Skeleton className="h-24 w-full" />
      </div>
     )}
    </TabsContent>
   </Tabs>
   </div>
   </div>
  </div>
 );
}
