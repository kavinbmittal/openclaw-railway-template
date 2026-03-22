/**
 * FilterBar — filter chips for project, agent, event type.
 */

import { X } from"lucide-react";

export function FilterBar({ filters, onRemove, onClear }) {
 if (!filters || filters.length === 0) return null;

 return (
  <div className="flex items-center gap-2 flex-wrap">
   {filters.map((f) => (
    <span
     key={f.key}
     className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[12px] font-medium text-secondary-foreground"
    >
     <span className="text-muted-foreground">{f.label}:</span>
     <span>{f.value}</span>
     <button
      className="ml-0.5 rounded-full hover:bg-accent p-0.5 transition-colors"
      onClick={() => onRemove(f.key)}
     >
      <X className="h-3 w-3" />
     </button>
    </span>
   ))}
   <button
    onClick={onClear}
    className="text-[12px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
   >
    Clear all
   </button>
  </div>
 );
}
