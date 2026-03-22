import { useState } from"react";
import { ChevronRight } from"lucide-react";

export function CollapsibleSection({ title, defaultOpen = false, children }) {
 const [open, setOpen] = useState(defaultOpen);

 return (
  <div className="border border-border">
   <button
    onClick={() => setOpen(!open)}
    className="w-full flex items-center gap-2 p-4 text-left hover:bg-secondary/50 transition-colors"
   >
    <ChevronRight
     size={14}
     className={`text-muted-foreground transition-transform duration-150 ${open ?"rotate-90" :""}`}
    />
    <h4 className="text-[14px] font-semibold text-muted-foreground">
     {title}
    </h4>
   </button>
   {open && (
    <div className="px-4 pb-4 border-t border-border/50 pt-3">
     {children}
    </div>
   )}
  </div>
 );
}
