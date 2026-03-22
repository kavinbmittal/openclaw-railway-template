/**
 * PriorityIcon — colored icon per priority level.
 * Adapted from Paperclip's PriorityIcon.
 */
import { AlertTriangle, ArrowUp, Minus, ArrowDown, Circle } from"lucide-react";

const PRIORITY_CONFIG = {
 urgent: { icon: AlertTriangle, color:"text-red-400", label:"Urgent" },
 high: { icon: ArrowUp, color:"text-orange-400", label:"High" },
 medium: { icon: Minus, color:"text-yellow-400", label:"Medium" },
 low: { icon: ArrowDown, color:"text-blue-400", label:"Low" },
 none: { icon: Circle, color:"text-muted-foreground/50", label:"None" },
};

export const PRIORITY_DOT = {
 urgent:"bg-red-400",
 high:"bg-orange-400",
 medium:"bg-yellow-400",
 low:"bg-blue-400",
 none:"bg-muted-foreground/50",
};

export const ALL_PRIORITIES = ["urgent","high","medium","low","none"];

export function PriorityIcon({ priority, showLabel = false, className ="" }) {
 const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.none;
 const Icon = config.icon;

 return (
  <span className={`inline-flex items-center gap-1.5 shrink-0 ${className}`}>
   <Icon className={`h-3.5 w-3.5 ${config.color}`} />
   {showLabel && <span className="text-[14px]">{config.label}</span>}
  </span>
 );
}

export function PriorityDot({ priority, className ="" }) {
 return (
  <span
   className={`inline-block h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[priority] || PRIORITY_DOT.none} ${className}`}
  />
 );
}
