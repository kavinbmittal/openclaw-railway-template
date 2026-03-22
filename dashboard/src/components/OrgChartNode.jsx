/**
 * OrgChartNode — single card for an agent/person in the org chart.
 */

const STATUS_DOT_COLOR = {
 active:"bg-green-400",
 running:"bg-cyan-400 animate-pulse",
 idle:"bg-yellow-400",
 error:"bg-red-400",
};

const TYPE_BORDER = {
 human:"border-amber-500/40",
 coordinator:"border-purple-500/40",
 lead:"border-blue-500/40",
 specialist:"border-green-500/40",
};

export function OrgChartNode({ node, onClick }) {
 const dotColor = STATUS_DOT_COLOR[node.status] ||"bg-neutral-400";
 const borderAccent = TYPE_BORDER[node.type] ||"border-border";

 return (
  <div
   className={`bg-background border ${borderAccent} px-4 py-3 min-w-[160px] max-w-[200px] cursor-pointer hover:bg-accent/30 hover:border-foreground/20 transition-all select-none`}
   onClick={onClick}
  >
   <div className="flex items-center gap-2.5">
    {/* Avatar / emoji */}
    <div className="relative shrink-0">
     <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-lg">
      {node.emoji || node.name?.[0] ||"?"}
     </div>
     <span
      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${dotColor}`}
     />
    </div>
    {/* Info */}
    <div className="flex flex-col min-w-0 flex-1">
     <span className="text-[14px] font-semibold text-foreground leading-tight truncate">
      {node.name}
     </span>
     <span className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
      {node.role ? (node.role.length > 40 ? node.role.slice(0, 40) +"..." : node.role) : node.type}
     </span>
    </div>
   </div>
   {/* Project badges */}
   {node.projects?.length > 0 && (
    <div className="flex items-center gap-1 mt-2 flex-wrap">
     {node.projects.map((p) => (
      <span
       key={p}
       className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-mono bg-muted text-muted-foreground"
      >
       {p}
      </span>
     ))}
    </div>
   )}
  </div>
 );
}
