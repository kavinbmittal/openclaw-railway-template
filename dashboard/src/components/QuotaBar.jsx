/**
 * QuotaBar — budget / quota progress bar.
 * Ported from Paperclip's QuotaBar.
 */

function fillColor(pct) {
 if (pct > 95) return"bg-red-400";
 if (pct > 80) return"bg-orange-400";
 if (pct > 60) return"bg-yellow-400";
 return"bg-green-400";
}

export function QuotaBar({
 label,
 percentUsed,
 leftLabel,
 rightLabel,
 showDeficitNotch = false,
 className ="",
}) {
 const clampedPct = Math.min(100, Math.max(0, percentUsed));
 const notchLeft = Math.min(clampedPct, 97);

 return (
  <div className={`space-y-1.5 ${className}`}>
   {/* row header */}
   <div className="flex items-center justify-between gap-2">
    <span className="text-[12px] text-muted-foreground">{label}</span>
    <div className="flex items-center gap-2 shrink-0">
     <span className="text-[12px] font-medium tabular-nums">{leftLabel}</span>
     {rightLabel && (
      <span className="text-[12px] text-muted-foreground tabular-nums">{rightLabel}</span>
     )}
    </div>
   </div>

   {/* track */}
   <div className="relative h-2 w-full border border-border overflow-hidden">
    {/* fill */}
    <div
     className={`absolute inset-y-0 left-0 transition-[width,background-color] duration-150 ${fillColor(clampedPct)}`}
     style={{ width: `${clampedPct}%` }}
    />
    {/* deficit notch */}
    {showDeficitNotch && clampedPct > 0 && (
     <div
      className="absolute inset-y-0 w-[2px] bg-destructive z-10"
      style={{ left: `${notchLeft}%` }}
     />
    )}
   </div>
  </div>
 );
}
