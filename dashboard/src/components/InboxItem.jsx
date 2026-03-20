/**
 * InboxItem — row component for unified inbox items.
 * Displays icon (type indicator), title, project badge, timestamp, and action buttons.
 */

import {
  ShieldCheck,
  DollarSign,
  Clock,
  FileText,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";

const TYPE_CONFIG = {
  approval: {
    icon: ShieldCheck,
    iconBg: "bg-amber-900/40",
    iconColor: "text-amber-400",
    label: "Approval",
  },
  budget: {
    icon: DollarSign,
    iconBg: "bg-red-900/40",
    iconColor: "text-red-400",
    label: "Budget",
  },
  stale_task: {
    icon: Clock,
    iconBg: "bg-yellow-900/40",
    iconColor: "text-yellow-400",
    label: "Stale Task",
  },
  standup: {
    icon: FileText,
    iconBg: "bg-blue-900/40",
    iconColor: "text-blue-400",
    label: "Standup",
  },
};

function formatTimeAgo(isoString) {
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

export function InboxItem({ item, onApprove, onReject, onNavigate }) {
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.stale_task;
  const Icon = item.type === "budget" && item.severity === "critical" ? AlertTriangle : config.icon;
  const iconBg = item.type === "budget" && item.severity === "critical" ? "bg-red-900/40" : config.iconBg;
  const iconColor = item.type === "budget" && item.severity === "critical" ? "text-red-400" : config.iconColor;

  return (
    <div className="group flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 transition-colors hover:bg-accent/30">
      {/* Type icon */}
      <span className={`shrink-0 rounded-md p-1.5 mt-0.5 ${iconBg}`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-sm font-medium text-foreground truncate cursor-pointer hover:underline"
            onClick={() => onNavigate && onNavigate("project", item.project)}
          >
            {item.title}
          </span>
        </div>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-accent text-accent-foreground">
            {item.project}
          </span>
          {item.requester && (
            <span className="text-[11px] text-muted-foreground">by {item.requester}</span>
          )}
          {item.gate && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-900/50 text-amber-300">
              {item.gate}
            </span>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <div className="shrink-0 text-right">
        <span className="text-xs text-muted-foreground/60">
          {formatTimeAgo(item.timestamp)}
        </span>
      </div>

      {/* Actions for approvals */}
      {item.type === "approval" && onApprove && onReject && (
        <div className="hidden sm:flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onApprove(item); }}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-700 text-white rounded-md hover:bg-green-600 transition-colors"
          >
            <Check size={12} />
            Approve
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onReject(item); }}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-700 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            <X size={12} />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
