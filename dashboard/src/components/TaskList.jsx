import { Circle, Pause, ListTodo, CheckCircle2 } from"lucide-react";
import Markdown from"./Markdown.jsx";

const SECTION_CONFIG = {
"In Progress": { icon: Circle, color:"text-cyan-400", dotColor:"bg-cyan-400", label:"In Progress" },
"Waiting On": { icon: Pause, color:"text-amber-400", dotColor:"bg-amber-400", label:"Waiting" },
"To Do": { icon: ListTodo, color:"text-muted-foreground", dotColor:"bg-muted-foreground", label:"To Do" },
"Done (this week)": { icon: CheckCircle2, color:"text-green-400", dotColor:"bg-green-400", label:"Done" },
};

function stripMarkdown(text) {
 return text
  .replace(/\*\*(.+?)\*\*/g,"$1")
  .replace(/\*(.+?)\*/g,"$1")
  .replace(/__(.+?)__/g,"$1")
  .replace(/_(.+?)_/g,"$1")
  .replace(/~~(.+?)~~/g,"$1")
  .replace(/`(.+?)`/g,"$1")
  .replace(/\[(.+?)\]\(.+?\)/g,"$1")
  .replace(/^>\s?/gm,"")
  .replace(/^#{1,6}\s+/gm,"")
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
    sections[current].push({ text: cleaned, date: dateMatch?.[1] || null });
   }
  }
 }

 return Object.keys(sections).length > 0 ? sections : null;
}

export function TaskList({ tasksRaw }) {
 const parsed = parseTasks(tasksRaw);

 if (!parsed) {
  return (
   <div className="bg-card rounded-[2px] border border-border shadow-sm p-[20px] text-center">
    <p className="text-[14px] text-muted-foreground/60">No active tasks</p>
   </div>
  );
 }

 return (
  <div className="space-y-4">
   {Object.entries(SECTION_CONFIG).map(([key, config]) => {
    const items = parsed[key];
    if (!items || items.length === 0) return null;
    const Icon = config.icon;

    return (
     <div key={key} className="border border-border">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-accent/20">
       <Icon size={14} className={config.color} />
       <span className={`text-[11px] uppercase tracking-[0.16em] font-mono font-medium ${config.color}`}>
        {config.label}
       </span>
       <span className="text-[11px] text-muted-foreground/50 font-mono">
        {items.length}
       </span>
      </div>
      <div className="divide-y divide-border">
       {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-2.5 text-[14px]">
         <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${config.dotColor}`} />
         <span className="text-foreground/80 flex-1"><Markdown content={item.text} className="text-[14px]" /></span>
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
 );
}
