/**
 * MetricCard — large-number stat card.
 * Ported from Paperclip's MetricCard, simplified (no router Link).
 */

export function MetricCard({ icon: Icon, value, label, description, mono, onClick, className ="" }) {
 const isClickable = !!onClick;

 return (
  <div
   className={`bg-card rounded-sm border border-border shadow-sm px-4 py-4 sm:px-5 sm:py-5 transition-colors ${isClickable ?"hover:bg-accent/50 cursor-pointer" :""} ${className}`}
   onClick={onClick}
  >
   <div className="flex items-start justify-between gap-3">
    <div className="flex-1 min-w-0">
     <p
      className={`text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums ${mono ?"font-mono" :""}`}
     >
      {value}
     </p>
     <p className="text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground mt-1">
      {label}
     </p>
     {description && (
      <div className="text-xs text-muted-foreground/70 mt-1.5 hidden sm:block">
       {description}
      </div>
     )}
    </div>
    {Icon && (
     <Icon className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1.5" />
    )}
   </div>
  </div>
 );
}
