/**
 * AssigneeSelect — dropdown for selecting an assignee agent.
 */
import { useState, useRef, useEffect } from"react";
import { User } from"lucide-react";

const AGENTS = [
 { id:"sam", name:"Sam", emoji:"S" },
 { id:"binny", name:"Binny", emoji:"B" },
 { id:"ej", name:"EJ", emoji:"E" },
 { id:"kiko", name:"Kiko", emoji:"K" },
 { id:"leslie", name:"Leslie", emoji:"L" },
 { id:"zara", name:"Zara", emoji:"Z" },
 { id:"ritam", name:"Ritam", emoji:"R" },
 { id:"jon", name:"Jon", emoji:"J" },
 { id:"midas", name:"Midas", emoji:"M" },
];

function AgentInitial({ name, className ="" }) {
 const initial = (name ||"?")[0].toUpperCase();
 return (
  <span
   className={`inline-flex items-center justify-center h-5 w-5 rounded-full bg-accent text-[11px] font-bold text-foreground shrink-0 ${className}`}
  >
   {initial}
  </span>
 );
}

export function AssigneeSelect({ value, onChange, agents = AGENTS, className ="" }) {
 const [open, setOpen] = useState(false);
 const [search, setSearch] = useState("");
 const ref = useRef(null);

 useEffect(() => {
  if (!open) return;
  function handleClick(e) {
   if (ref.current && !ref.current.contains(e.target)) setOpen(false);
  }
  document.addEventListener("mousedown", handleClick);
  return () => document.removeEventListener("mousedown", handleClick);
 }, [open]);

 const filtered = agents.filter((a) =>
  !search.trim() || a.name.toLowerCase().includes(search.toLowerCase())
 );

 const currentAgent = agents.find((a) => a.id === value);

 return (
  <div className={`relative ${className}`} ref={ref}>
   <button
    onClick={() => { setOpen(!open); setSearch(""); }}
    className="inline-flex items-center gap-1.5 cursor-pointer hover:bg-accent/50 rounded px-1.5 py-1 transition-colors text-[14px]"
   >
    {currentAgent ? (
     <>
      <AgentInitial name={currentAgent.name} />
      {currentAgent.name}
     </>
    ) : (
     <>
      <User className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">Unassigned</span>
     </>
    )}
   </button>
   {open && (
    <div className="absolute z-50 mt-1 w-48 rounded-[6px] border border-border bg-card p-1 shadow-lg">
     <input
      className="w-full px-2 py-1.5 text-[12px] bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
      placeholder="Search agents..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      autoFocus
     />
     <div className="max-h-48 overflow-y-auto">
      <button
       className={`flex items-center gap-2 w-full px-2 py-1.5 text-[12px] rounded hover:bg-accent/50 transition-colors text-left ${
        !value ?"bg-accent" :""
       }`}
       onClick={() => { onChange(null); setOpen(false); }}
      >
       <User className="h-3.5 w-3.5 text-muted-foreground" />
       Unassigned
      </button>
      {filtered.map((a) => (
       <button
        key={a.id}
        className={`flex items-center gap-2 w-full px-2 py-1.5 text-[12px] rounded hover:bg-accent/50 transition-colors text-left ${
         a.id === value ?"bg-accent" :""
        }`}
        onClick={() => { onChange(a.id); setOpen(false); }}
       >
        <AgentInitial name={a.name} />
        {a.name}
       </button>
      ))}
     </div>
    </div>
   )}
  </div>
 );
}

export { AGENTS, AgentInitial };
