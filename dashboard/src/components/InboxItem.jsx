/**
 * InboxItem — row component for unified inbox items.
 * Displays icon (type indicator), title, project badge, timestamp, and action buttons.
 */

import {
 ShieldCheck,
 DollarSign,
 Clock,
 FileText,
 CircleDot,
 Check,
 X,
 AlertTriangle,
} from"lucide-react";
import { formatTimeAgo } from"../utils/formatDate.js";

const TYPE_CONFIG = {
 approval: {
  icon: ShieldCheck,
  iconBg:"bg-amber-900/40",
  iconColor:"text-amber-400",
  label:"Approval",
 },
 budget: {
  icon: DollarSign,
  iconBg:"bg-red-900/40",
  iconColor:"text-red-400",
  label:"Budget",
 },
 stale_task: {
  icon: Clock,
  iconBg:"bg-yellow-900/40",
  iconColor:"text-yellow-400",
  label:"Stale Task",
 },
 standup: {
  icon: FileText,
  iconBg:"bg-blue-900/40",
  iconColor:"text-blue-400",
  label:"Standup",
 },
 proposed_issue: {
  icon: CircleDot,
  iconBg:"bg-violet-900/40",
  iconColor:"text-violet-400",
  label:"Proposed Issue",
 },
};

function handleItemClick(item, onNavigate) {
 if (!onNavigate) return;
 switch (item.type) {
  case"approval":
   // Navigate to approvals page for all approval items
   onNavigate("approvals");
   break;
  case"standup":
   // Navigate to project standups tab
   if (item.project && item.project !=="general") {
    onNavigate("project-tab", { slug: item.project, tab:"standups" });
   }
   break;
  case"stale_task":
   // Navigate to issue detail if we have a project and issue id
   if (item.project && item.project !=="general" && item.id) {
    onNavigate("issue-detail", { projectSlug: item.project, issueId: item.id });
   }
   break;
  case"budget":
   // Navigate to project costs tab
   if (item.project && item.project !=="general") {
    onNavigate("project-tab", { slug: item.project, tab:"costs" });
   }
   break;
  case"proposed_issue":
   // Navigate to project issues tab where proposed issues appear
   if (item.project && item.project !=="general") {
    onNavigate("project-tab", { slug: item.project, tab:"issues" });
   }
   break;
  default:
   if (item.project && item.project !=="general") {
    onNavigate("project", item.project);
   }
 }
}

export function InboxItem({ item, onApprove, onReject, onNavigate }) {
 const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.stale_task;
 const Icon = item.type ==="budget" && item.severity ==="critical" ? AlertTriangle : config.icon;
 const iconBg = item.type ==="budget" && item.severity ==="critical" ?"bg-red-900/40" : config.iconBg;
 const iconColor = item.type ==="budget" && item.severity ==="critical" ?"text-red-400" : config.iconColor;

 const hasRealProject = item.project && item.project !=="general";
 const isDeliverable = item.gate ==="deliverable" || item.gate ==="deliverable-review";

 return (
  <div
   className="group flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 transition-colors hover:bg-accent/30 cursor-pointer"
   onClick={() => handleItemClick(item, onNavigate)}
  >
   {/* Type icon */}
   <span className={`shrink-0 p-1.5 mt-0.5 ${iconBg}`}>
    <Icon className={`h-4 w-4 ${iconColor}`} />
   </span>

   {/* Content */}
   <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2 mb-0.5">
     <span className="text-[14px] font-medium text-foreground truncate">
      {item.title}
     </span>
    </div>
    {item.subtitle && (
     <p className="text-[12px] text-muted-foreground truncate">{item.subtitle}</p>
    )}
    <div className="flex items-center gap-2 mt-1">
     {hasRealProject ? (
      <span
       className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-accent text-accent-foreground cursor-pointer hover:underline"
       onClick={(e) => { e.stopPropagation(); onNavigate && onNavigate("project", item.project); }}
      >
       {item.project}
      </span>
     ) : item.requester ? (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-accent text-accent-foreground">
       {item.requester}
      </span>
     ) : null}
     {item.requester && hasRealProject && (
      <span className="text-[11px] text-muted-foreground">by {item.requester}</span>
     )}
     {item.gate && (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-900/50 text-amber-300">
       {item.gate}
      </span>
     )}
    </div>
   </div>

   {/* Timestamp */}
   <div className="shrink-0 text-right">
    <span className="text-[12px] text-muted-foreground/60">
     {formatTimeAgo(item.timestamp)}
    </span>
   </div>

   {/* Actions for approvals */}
   {item.type ==="approval" && onApprove && onReject && (
    <div className="hidden sm:flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
     <button
      onClick={(e) => { e.stopPropagation(); onApprove(item); }}
      className="inline-flex items-center gap-1 px-2 py-1 text-[12px] font-medium rounded-[6px] bg-green-700 text-white hover:bg-green-600 transition-colors"
     >
      <Check size={12} />
      Approve
     </button>
     <button
      onClick={(e) => { e.stopPropagation(); onReject(item); }}
      className="inline-flex items-center gap-1 px-2 py-1 text-[12px] font-medium rounded-[6px] bg-red-700 text-white hover:bg-red-600 transition-colors"
     >
      <X size={12} />
      Reject
     </button>
    </div>
   )}
  </div>
 );
}
