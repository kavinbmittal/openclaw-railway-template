/**
 * MetricCard — large-number stat card.
 * Styling ported directly from Aura reference HTML.
 */

export function MetricCard({ icon: Icon, value, label, description, mono, onClick, className ="" }) {
 const isClickable = !!onClick;

 return (
  <div
   className={`bg-card border border-border rounded-[2px] p-[20px] shadow-sm hover:bg-accent/30 transition-colors cursor-default group ${isClickable ?"!cursor-pointer" :""} ${className}`}
   onClick={onClick}
  >
   <div className="flex justify-between items-start mb-2">
    <div
     className={`text-[30px] font-semibold text-foreground leading-none tracking-tight ${mono ?"font-mono" :""} tabular-nums`}
    >
     {value}
    </div>
    {Icon && (
     <Icon className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" size={20} />
    )}
   </div>
   <div className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
    {label}
   </div>
   {description && (
    <div className="text-[12px] text-muted-foreground/70 mt-1.5 hidden sm:block">
     {description}
    </div>
   )}
  </div>
 );
}
