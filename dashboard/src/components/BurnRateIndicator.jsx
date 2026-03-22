/**
 * BurnRateIndicator — shows daily/weekly burn rate with trend arrow.
 * Inspired by Paperclip cost display patterns.
 */

import { TrendingUp, TrendingDown, Minus } from"lucide-react";

export function BurnRateIndicator({ dailyRate = 0, weeklyRate, trend, compact = false }) {
 const weekly = weeklyRate ?? dailyRate * 7;
 const displayRate = compact ? dailyRate : weekly;
 const label = compact ?"/day" :"/week";

 // Determine trend icon
 const TrendIcon = trend ==="up" ? TrendingUp : trend ==="down" ? TrendingDown : Minus;
 const trendColor =
  trend ==="up"
   ?"text-red-400"
   : trend ==="down"
    ?"text-green-400"
    :"text-muted-foreground/50";

 if (compact) {
  return (
   <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
    <TrendIcon size={10} className={trendColor} />
    <span className="font-mono tabular-nums">${displayRate.toFixed(2)}</span>
    <span>{label}</span>
   </span>
  );
 }

 return (
  <div className="flex items-center gap-2">
   <div className="flex items-center gap-1.5">
    <TrendIcon size={14} className={trendColor} />
    <span className="text-[14px] font-mono tabular-nums font-medium text-foreground">
     ${displayRate.toFixed(2)}
    </span>
    <span className="text-[12px] text-muted-foreground">{label}</span>
   </div>
   <span className="text-[11px] text-muted-foreground/50">
    (${dailyRate.toFixed(2)}/day)
   </span>
  </div>
 );
}
