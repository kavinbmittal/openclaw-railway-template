import { useState, useEffect } from"react";
import { getAgent, getAgentActivity, getAgentRuns } from"../api.js";
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

 useEffect(() => {
  setLoading(true);
  getAgent(agentId)
   .then((data) => {
    setAgent(data);
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

 return (
  <div className="space-y-6">
   <AgentHeader agent={agent} navigate={navigate} />

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
         <h3 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Current Work
         </h3>
        </div>
        <div className="space-y-1.5">
         {agent.inProgress.map((task, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
           <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-cyan-400" />
           <span className="text-foreground/80">{task}</span>
          </div>
         ))}
        </div>
       </div>
      )}

      {/* Waiting on */}
      {agent.waitingOn && agent.waitingOn.length > 0 && (
       <div className="border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
         <Clock size={14} className="text-amber-400" />
         <h3 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Waiting On
         </h3>
        </div>
        <div className="space-y-1.5">
         {agent.waitingOn.map((task, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
           <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-amber-400" />
           <span className="text-foreground/80">{task}</span>
          </div>
         ))}
        </div>
       </div>
      )}

      {/* Projects */}
      {agent.projects && agent.projects.length > 0 && (
       <div className="border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
         <Briefcase size={14} className="text-muted-foreground/50" />
         <h3 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Projects
         </h3>
        </div>
        <div className="space-y-1">
         {agent.projects.map((p) => (
          <button
           key={p.id}
           onClick={() => navigate("project", p.id)}
           className="flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground transition-colors w-full text-left py-1"
          >
           <span className="w-3 h-3 rounded-sm bg-primary/30 shrink-0" />
           {p.title}
          </button>
         ))}
        </div>
       </div>
      )}

      {/* SOUL summary */}
      {agent.soulSummary && (
       <div className="border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
         <Brain size={14} className="text-muted-foreground/50" />
         <h3 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Identity
         </h3>
        </div>
        <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-line">
         {agent.soulSummary}
        </p>
       </div>
      )}

      {/* Idle state */}
      {agent.status ==="idle" && (!agent.inProgress || agent.inProgress.length === 0) && (
       <div className="border border-border p-6 text-center">
        <p className="text-sm text-muted-foreground/60">
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
 );
}
