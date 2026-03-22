import { useState, useEffect } from"react";
import { getFile } from"../api.js";
import { MetricCard } from"../components/MetricCard.jsx";
import { Badge } from"../components/ui/Badge.jsx";
import { Circle, Clock, Pause, CheckCircle2, ListTodo, ChevronRight } from"lucide-react";
import Markdown from"../components/Markdown.jsx";

const AGENTS = [
 { name:"Sam", workspace:"workspace", role:"Cross-project coordinator", canLead: false },
 { name:"Binny", workspace:"workspace-binny", role:"Lia PM", canLead: true },
 { name:"EJ", workspace:"workspace-ej", role:"Engineering", canLead: false },
 { name:"Kiko", workspace:"workspace-kiko", role:"Celestial PM, Design", canLead: true },
 { name:"Leslie", workspace:"workspace-leslie-marketer", role:"Growth, Outreach", canLead: true },
 { name:"Zara", workspace:"workspace-zara-design", role:"Design, UX, Research", canLead: true },
 { name:"Ritam", workspace:"workspace-ritam", role:"Researcher", canLead: true },
 { name:"Jon", workspace:"workspace-jon-appideas", role:"Apps Research", canLead: false },
 { name:"Midas", workspace:"workspace-midas", role:"Crypto", canLead: true },
];

const SECTION_CONFIG = {
"In Progress": { icon: Circle, color:"text-cyan-400", dotColor:"bg-cyan-400", label:"In Progress" },
"Waiting On": { icon: Pause, color:"text-amber-400", dotColor:"bg-amber-400", label:"Waiting" },
"To Do": { icon: ListTodo, color:"text-muted-foreground", dotColor:"bg-muted-foreground", label:"To Do" },
"Done (this week)": { icon: CheckCircle2, color:"text-green-400", dotColor:"bg-green-400", label:"Done" },
};

function stripMarkdown(text) {
 return text
  .replace(/\*\*(.+?)\*\*/g,"$1")    // **bold**
  .replace(/\*(.+?)\*/g,"$1")       // *italic*
  .replace(/__(.+?)__/g,"$1")       // __bold__
  .replace(/_(.+?)_/g,"$1")        // _italic_
  .replace(/~~(.+?)~~/g,"$1")       // ~~strikethrough~~
  .replace(/`(.+?)`/g,"$1")        // `code`
  .replace(/\[(.+?)\]\(.+?\)/g,"$1")   // [link](url)
  .replace(/^>\s?/gm,"")         // > blockquote
  .replace(/^#{1,6}\s+/gm,"")       // # headers
  .trim();
}

function parseTasks(raw) {
 if (!raw) return null;
 const sections = {};
 let current = null;

 for (const line of raw.split("\n")) {
  const headerMatch = line.match(/^##\s+(.+)/);
  if (headerMatch) {
   current = headerMatch[1].trim();
   sections[current] = [];
   continue;
  }
  if (current && line.startsWith("-")) {
   const text = line.slice(2).trim();
   const dateMatch = text.match(/\(last-updated:\s*(\d{4}-\d{2}-\d{2})\)/);
   const cleaned = stripMarkdown(
    text.replace(/\(last-updated:\s*\d{4}-\d{2}-\d{2}\)/,"").trim()
   );
   if (cleaned) {
    sections[current].push({
     text: cleaned,
     date: dateMatch?.[1] || null,
    });
   }
  }
 }

 return Object.keys(sections).length > 0 ? sections : null;
}

export default function AgentList({ navigate }) {
 const [tasks, setTasks] = useState({});

 useEffect(() => {
  AGENTS.forEach((agent) => {
   getFile(`${agent.workspace}/memory/active-tasks.md`)
    .then((data) => setTasks((prev) => ({ ...prev, [agent.name]: data.content ||"" })))
    .catch(() => setTasks((prev) => ({ ...prev, [agent.name]: null })));
  });
 }, []);

 const leads = AGENTS.filter((a) => a.canLead);
 const specialists = AGENTS.filter((a) => !a.canLead);

 return (
  <div className="space-y-6">
   <div className="h-12 flex items-center">
    <h1 className="text-base font-semibold uppercase tracking-wider">Agents</h1>
   </div>

   <div className="grid grid-cols-3 gap-1">
    <MetricCard label="Total" value={AGENTS.length} />
    <MetricCard label="Can Lead" value={leads.length} />
    <MetricCard label="Specialists" value={specialists.length} />
   </div>

   <div>
    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
     Project Leads
    </h3>
    <div className="border border-border divide-y divide-border">
     {leads.map((agent) => (
      <AgentRow key={agent.name} agent={agent} rawTasks={tasks[agent.name]} navigate={navigate} />
     ))}
    </div>
   </div>

   <div>
    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
     Specialists
    </h3>
    <div className="border border-border divide-y divide-border">
     {specialists.map((agent) => (
      <AgentRow key={agent.name} agent={agent} rawTasks={tasks[agent.name]} navigate={navigate} />
     ))}
    </div>
   </div>
  </div>
 );
}

function AgentRow({ agent, rawTasks, navigate }) {
 const [expanded, setExpanded] = useState(false);
 const parsed = parseTasks(rawTasks);

 // Count in-progress tasks for the badge
 const inProgressCount = parsed?.["In Progress"]?.length || 0;
 const firstTask = parsed?.["In Progress"]?.[0]?.text;
 const isActive = inProgressCount > 0;

 const handleClick = () => {
  if (navigate) {
   navigate("agent-detail", agent.workspace);
  }
 };

 const handleExpandToggle = (e) => {
  e.stopPropagation();
  setExpanded(!expanded);
 };

 return (
  <div>
   <div
    onClick={handleClick}
    className="flex items-center gap-3 px-4 py-2.5 text-sm w-full text-left transition-colors hover:bg-accent/50 cursor-pointer"
   >
    {/* Status dot */}
    <span className="relative flex h-2 w-2 shrink-0">
     {isActive ? (
      <>
       <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-50" />
       <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]" />
      </>
     ) : (
      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#6b7280]" />
     )}
    </span>

    {/* Name and role */}
    <div className="flex-1 min-w-0">
     <div className="flex items-center gap-2">
      <span className="font-medium text-foreground shrink-0">{agent.name}</span>
      <span className="text-xs text-muted-foreground truncate">{agent.role}</span>
     </div>
     {/* Current work subtitle */}
     {firstTask && (
      <p className="text-xs text-muted-foreground/60 truncate mt-0.5">
       {firstTask}
      </p>
     )}
    </div>

    {inProgressCount > 0 && (
     <span className="text-xs text-cyan-400 font-mono tabular-nums shrink-0">
      {inProgressCount} active
     </span>
    )}

    {agent.canLead && (
     <Badge variant="secondary" className="shrink-0">
      lead
     </Badge>
    )}

    {/* Expand toggle */}
    <button
     onClick={handleExpandToggle}
     className="text-muted-foreground/50 text-xs shrink-0 p-1 hover:text-foreground transition-colors"
    >
     {rawTasks !== undefined ? (expanded ?"\u25BE" :"\u25B8") :""}
    </button>

    {/* Navigate arrow */}
    <ChevronRight size={14} className="text-muted-foreground/30 shrink-0" />
   </div>

   {expanded && rawTasks !== undefined && (
    <div className="px-4 pb-3 pt-1" onClick={(e) => e.stopPropagation()}>
     {parsed ? (
      <div className="space-y-3">
       {Object.entries(SECTION_CONFIG).map(([key, config]) => {
        const items = parsed[key];
        if (!items || items.length === 0) return null;
        const Icon = config.icon;
        return (
         <div key={key}>
          <div className="flex items-center gap-1.5 mb-1.5">
           <Icon size={12} className={config.color} />
           <span className={`text-[11px] uppercase tracking-widest font-mono font-medium ${config.color}`}>
            {config.label}
           </span>
           <span className="text-[11px] text-muted-foreground/50 font-mono">
            {items.length}
           </span>
          </div>
          <div className="space-y-0.5">
           {items.map((item, i) => (
            <div
             key={i}
             className="flex items-start gap-2 py-1 pl-1 text-xs"
            >
             <span className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${config.dotColor}`} />
             <span className="text-foreground/80 flex-1"><Markdown content={item.text} className="text-xs" /></span>
             {item.date && (
              <span className="text-[11px] text-muted-foreground/50 font-mono tabular-nums shrink-0">
               {item.date}
              </span>
             )}
            </div>
           ))}
          </div>
         </div>
        );
       })}
      </div>
     ) : rawTasks ? (
      <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/30 p-3 max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-auto-hide">
       {rawTasks.slice(0, 800)}
       {rawTasks.length > 800 ?"\n..." :""}
      </pre>
     ) : (
      <p className="text-xs text-muted-foreground/60 py-2">No active tasks file</p>
     )}
    </div>
   )}
  </div>
 );
}
