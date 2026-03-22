/**
 * EntityRow — generic list row with leading slot, title, subtitle, trailing slot.
 * Ported from Paperclip's EntityRow, simplified (no router Link).
 */

export function EntityRow({
 leading,
 identifier,
 title,
 subtitle,
 trailing,
 selected,
 onClick,
 className ="",
}) {
 const isClickable = !!onClick;

 return (
  <div
   className={`flex items-center gap-4 px-5 py-3 text-[14px] transition-colors ${
    isClickable ?"cursor-pointer hover:bg-accent/50 transition-colors" :""
   } ${selected ?"bg-accent/30" :""} ${className}`}
   onClick={onClick}
  >
   {leading && <div className="flex items-center gap-2 shrink-0">{leading}</div>}
   <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2">
     {identifier && (
      <span className="text-[12px] text-muted-foreground font-mono shrink-0 relative top-[1px]">
       {identifier}
      </span>
     )}
     <span className="truncate">{title}</span>
    </div>
    {subtitle && (
     <p className="text-[12px] text-muted-foreground truncate mt-0.5">{subtitle}</p>
    )}
   </div>
   {trailing && <div className="flex items-center gap-2 shrink-0">{trailing}</div>}
  </div>
 );
}
