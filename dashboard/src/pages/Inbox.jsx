import { useState, useEffect, useMemo } from "react";
import { getInbox } from "../api.js";
import { ShieldCheck, Wallet, Clock, MessageSquare, CheckCircle } from "lucide-react";
import { Skeleton } from "../components/ui/Skeleton.jsx";
import { formatTimeAgo } from "../utils/formatDate.js";

/**
 * Shortens formatTimeAgo output for compact inbox display.
 * "15m ago" → "15m", "2h ago" → "2h", "1d ago" → "1d"
 */
function shortTime(dateStr) {
  const full = formatTimeAgo(dateStr);
  if (!full) return "";
  return full.replace(" ago", "");
}

/**
 * Category definitions — each maps to a section card in the inbox.
 * Icon, title, item filter, badge color config, and click handler.
 */
const CATEGORIES = [
  {
    key: "approvals",
    title: "Pending Approvals",
    icon: ShieldCheck,
    headerClass: "bg-amber-500/[0.02] hover:bg-amber-500/[0.05]",
    badgeBg: "bg-amber-500/10",
    badgeBorder: "border-amber-500/20",
    text: "text-amber-400",
    titleText: "text-amber-100",
    countBg: "bg-amber-500/10",
    countBorder: "border-amber-500/20",
    filter: (item) => item.type === "approval" || item.type === "proposed_issue",
    alwaysShow: true,
    badgeColor: (item) =>
      item.type === "proposed_issue"
        ? "border-violet-500/20 bg-violet-500/10 text-violet-400"
        : "border-amber-500/20 bg-amber-500/10 text-amber-400",
    badgeLabel: (item) =>
      item.type === "proposed_issue"
        ? "Proposed Issue"
        : item.gate || "Approval",
    onClick: (item, navigate) => {
      navigate("approval-detail", item.id);
    },
  },
  {
    key: "budget",
    title: "Budget Alerts",
    icon: Wallet,
    headerClass: "bg-red-500/[0.02] hover:bg-red-500/[0.05]",
    badgeBg: "bg-red-500/10",
    badgeBorder: "border-red-500/20",
    text: "text-red-400",
    titleText: "text-red-100",
    countBg: "bg-red-500/10",
    countBorder: "border-red-500/20",
    filter: (item) => item.type === "budget",
    alwaysShow: false,
    badgeColor: (item) =>
      item.severity === "critical"
        ? "border-red-500/20 bg-red-500/10 text-red-400"
        : "border-amber-500/20 bg-amber-500/10 text-amber-400",
    badgeLabel: (item) =>
      item.severity === "critical" ? "Critical" : "Warning",
    onClick: (item, navigate) => {
      if (item.project && item.project !== "general") {
        navigate("project-tab", { slug: item.project, tab: "costs" });
      }
    },
  },
  {
    key: "stale_tasks",
    title: "Stale Tasks",
    icon: Clock,
    headerClass: "bg-cyan-500/[0.02] hover:bg-cyan-500/[0.05]",
    badgeBg: "bg-cyan-500/10",
    badgeBorder: "border-cyan-500/20",
    text: "text-cyan-400",
    titleText: "text-cyan-100",
    countBg: "bg-cyan-500/10",
    countBorder: "border-cyan-500/20",
    filter: (item) => item.type === "stale_task",
    alwaysShow: false,
    isStaleRow: true,
    onClick: (item, navigate) => {
      if (item.project && item.project !== "general" && item.id) {
        navigate("issue-detail", { projectSlug: item.project, issueId: item.id });
      }
    },
  },
  {
    key: "standups",
    title: "Standups",
    icon: MessageSquare,
    headerClass: "bg-emerald-500/[0.02] hover:bg-emerald-500/[0.05]",
    badgeBg: "bg-emerald-500/10",
    badgeBorder: "border-emerald-500/20",
    text: "text-emerald-400",
    titleText: "text-emerald-100",
    countBg: "bg-emerald-500/10",
    countBorder: "border-emerald-500/20",
    filter: (item) => item.type === "standup",
    alwaysShow: false,
    badgeColor: () => "border-blue-500/20 bg-blue-500/10 text-blue-400",
    badgeLabel: () => "Standup",
    onClick: (item, navigate) => {
      if (item.project && item.project !== "general") {
        navigate("project-tab", { slug: item.project, tab: "standups" });
      }
    },
  },
];

export default function Inbox({ navigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function refresh() {
    setLoading(true);
    getInbox()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  // Group items by category
  const grouped = useMemo(() => {
    if (!data?.items) return {};
    const result = {};
    for (const cat of CATEGORIES) {
      result[cat.key] = data.items.filter(cat.filter);
    }
    return result;
  }, [data]);

  // Total count across all categories
  const totalCount = useMemo(() => {
    return Object.values(grouped).reduce((sum, items) => sum + items.length, 0);
  }, [grouped]);

  if (loading && !data) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex justify-between items-center mb-1">
          <h1 className="text-[16px] font-semibold uppercase tracking-[0.2em] text-foreground">Inbox</h1>
        </div>
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-[2px] shadow-sm p-[20px]">
              <Skeleton className="h-4 w-64 mb-2" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-1">
        <h1 className="text-[16px] font-semibold uppercase tracking-[0.2em] text-foreground">Inbox</h1>
      </div>
      <p className="text-[14px] text-muted-foreground mb-8">
        {totalCount} {totalCount === 1 ? "item needs" : "items need"} your attention
      </p>

      {/* Error */}
      {error && (
        <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-[14px] text-red-400 mb-6">
          {error}
        </div>
      )}

      {/* Sections */}
      <div className="space-y-6 pb-12">
        {CATEGORIES.map((cat) => {
          const items = grouped[cat.key] || [];
          if (items.length === 0 && !cat.alwaysShow) return null;

          const Icon = cat.icon;

          return (
            <div key={cat.key} className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col">
              {/* Section header — same pattern as Issues tab theme headers */}
              <div className={`flex items-center gap-3 px-5 py-3 ${cat.headerClass} transition-colors`}>
                <div className={`w-6 h-6 rounded-full ${cat.badgeBg} border ${cat.badgeBorder} flex items-center justify-center`}>
                  <Icon className={`w-3.5 h-3.5 ${cat.text}`} />
                </div>
                <div className={`text-[15px] font-medium ${cat.titleText}`}>{cat.title}</div>
                <div className={`text-[11px] font-mono ${cat.countBg} border ${cat.countBorder} px-1.5 py-0.5 rounded-[2px] ${cat.text}`}>
                  {items.length}
                </div>
              </div>

              {/* Empty state */}
              {items.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center">
                  <CheckCircle className="text-emerald-500 w-6 h-6 mb-3" />
                  <span className="text-[14px] text-muted-foreground mb-1">All clear</span>
                  <span className="text-[12px] text-muted-foreground/60">No items need your attention</span>
                </div>
              ) : cat.isStaleRow ? (
                /* Stale task rows — no type badge, amber idle time */
                items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className={`flex items-center gap-4 px-5 py-3 hover:bg-accent/40 cursor-pointer focus-within:bg-accent/40 transition-colors ${idx < items.length - 1 ? "border-b border-border/50" : ""}`}
                    onClick={() => cat.onClick(item, navigate)}
                  >
                    <Icon className="text-muted-foreground w-[18px] h-[18px] flex-shrink-0" />
                    <span className="text-[14px] text-foreground flex-1 truncate">{item.title}</span>
                    <span className="text-[12px] text-muted-foreground flex-shrink-0 w-32 truncate hidden md:block">
                      {item.requester || item.agent || ""}
                    </span>
                    <span className="text-[12px] text-muted-foreground/60 w-32 truncate hidden sm:block">
                      {item.project && item.project !== "general" ? item.project : ""}
                    </span>
                    <span className="text-[12px] font-mono text-amber-500 w-16 text-right flex-shrink-0">
                      {item.days_idle ? `${item.days_idle}d idle` : shortTime(item.timestamp)}
                    </span>
                  </div>
                ))
              ) : (
                /* Standard rows — icon, type badge, title, agent/project, time */
                items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className={`flex items-center gap-4 px-5 py-3 hover:bg-accent/40 cursor-pointer focus-within:bg-accent/40 transition-colors ${idx < items.length - 1 ? "border-b border-border/50" : ""}`}
                    onClick={() => cat.onClick(item, navigate)}
                  >
                    <Icon className="text-muted-foreground w-[18px] h-[18px] flex-shrink-0" />
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-normal border ${cat.badgeColor(item)} flex-shrink-0`}>
                      {cat.badgeLabel(item)}
                    </span>
                    <span className="text-[14px] text-foreground flex-1 truncate">{item.title}</span>
                    <span className="text-[12px] text-muted-foreground flex-shrink-0 w-32 truncate hidden sm:block">
                      {item.project && item.project !== "general" ? item.project : item.requester || ""}
                    </span>
                    <span className="text-[12px] font-mono text-muted-foreground/60 w-16 text-right flex-shrink-0">
                      {shortTime(item.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
