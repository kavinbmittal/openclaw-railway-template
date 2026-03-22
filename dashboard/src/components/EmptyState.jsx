/**
 * EmptyState — centered icon + message for empty sections.
 * Ported from Paperclip's EmptyState, extended with `sub` text.
 */

export function EmptyState({ icon: Icon, text, sub, action, onAction, className ="" }) {
 return (
  <div className={`flex flex-col items-center justify-center py-16 text-center border border-border ${className}`}>
   <div className="bg-muted/50 p-3 mb-4">
    <Icon className="h-8 w-8 text-muted-foreground/50" />
   </div>
   <p className="text-[14px] text-muted-foreground">{text}</p>
   {sub && <p className="text-[12px] text-muted-foreground/60 mt-1">{sub}</p>}
   {action && onAction && (
    <button
     onClick={onAction}
     className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-[14px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
    >
     {action}
    </button>
   )}
  </div>
 );
}
