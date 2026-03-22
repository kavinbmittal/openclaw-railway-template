/**
 * ProjectCostCard — card per project with QuotaBar, spend, remaining, burn rate.
 * Inspired by Paperclip's BillerSpendCard.
 */

import { QuotaBar } from"./QuotaBar.jsx";
import { TrendingUp, Calendar, User } from"lucide-react";
import { BurnRateIndicator } from"./BurnRateIndicator.jsx";

export function ProjectCostCard({ project, onClick }) {
 const {
  title,
  totalSpend = 0,
  budget = 0,
  remaining = 0,
  utilizationPct = 0,
  dailyBurnRate = 0,
  exhaustionDate,
  status,
  lead,
  agents = [],
 } = project;

 return (
  <div
   className={`bg-card rounded-[2px] border border-border shadow-sm p-[20px] space-y-3 transition-colors ${
    onClick ?"hover:bg-accent/50 cursor-pointer transition-colors" :""
   }`}
   onClick={onClick}
  >
   {/* Header */}
   <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
     <h4 className="text-[14px] font-semibold text-foreground truncate">
      {title || project.project}
     </h4>
     {lead && (
      <p className="text-[12px] text-muted-foreground flex items-center gap-1 mt-0.5">
       <User size={10} />
       {lead}
      </p>
     )}
    </div>
    <div className="text-right shrink-0">
     <span className="text-lg font-bold font-mono tabular-nums text-foreground">
      ${totalSpend.toFixed(2)}
     </span>
     {budget > 0 && (
      <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
       / ${budget}/wk
      </p>
     )}
    </div>
   </div>

   {/* QuotaBar */}
   {budget > 0 && (
    <QuotaBar
     label="Budget"
     percentUsed={utilizationPct}
     leftLabel={`$${totalSpend.toFixed(2)}`}
     rightLabel={`${utilizationPct}%`}
    />
   )}

   {/* Stats row */}
   <div className="flex items-center justify-between text-[12px] text-muted-foreground">
    <div className="flex items-center gap-3">
     <BurnRateIndicator dailyRate={dailyBurnRate} compact />
     {exhaustionDate && (
      <span className="flex items-center gap-1">
       <Calendar size={10} />
       Runs out {exhaustionDate}
      </span>
     )}
    </div>
    {budget > 0 && (
     <span className="font-mono tabular-nums">
      ${remaining.toFixed(2)} left
     </span>
    )}
   </div>

   {/* Status indicator */}
   {status && status !=="healthy" && (
    <div
     className={`text-[11px] uppercase tracking-[0.16em] font-mono font-medium px-2 py-1 inline-block ${
      status ==="exceeded"
       ?"text-red-400 bg-red-500/10 border border-red-500/20"
       :"text-amber-400 bg-amber-500/10 border border-amber-500/20"
     }`}
    >
     {status ==="exceeded" ?"Budget exceeded" :"Warning"}
    </div>
   )}

   {/* Agent count */}
   {agents.length > 0 && (
    <p className="text-[11px] text-muted-foreground/60">
     {agents.length} agent{agents.length === 1 ?"" :"s"} reporting costs
    </p>
   )}
  </div>
 );
}
