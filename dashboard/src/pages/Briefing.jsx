import { useState, useEffect, useMemo } from "react";
import { getInbox } from "../api.js";
import {
  ShieldCheck,
  AlertTriangle,
  Activity,
  CheckCircle,
  Clock,
  CalendarX,
  FlaskConical,
  Wallet,
  MessageSquare,
} from "lucide-react";
import { Skeleton } from "../components/ui/Skeleton.jsx";
import { formatTimeAgo } from "../utils/formatDate.js";

/**
 * Shortens formatTimeAgo output for compact display.
 * "15m ago" → "15m", "2h ago" → "2h", "1d ago" → "1d"
 */
function shortTime(dateStr) {
  const full = formatTimeAgo(dateStr);
  if (!full) return "";
  return full.replace(" ago", "");
}

/**
 * Section definitions — priority-ordered. Each maps to a visual tier.
 *
 * S1 (Decisions): elevated card with border-l accent — demands action
 * S2 (Risks): standard card with amber header — needs awareness
 * S3 (What Happened): standard card with muted rows — informational context
 */
const SECTIONS = [
  {
    key: "decisions",
    title: "Decisions Waiting",
    icon: ShieldCheck,
    filter: (item) =>
      item.type === "approval" ||
      item.type === "proposed_issue" ||
      item.type === "budget",
    showEmpty: true,
  },
  {
    key: "risks",
    title: "Risks",
    icon: AlertTriangle,
    filter: (item) =>
      item.type === "stale_task" ||
      item.type === "overdue_issue" ||
      item.type === "paused_experiment",
    showEmpty: false,
  },
  {
    key: "happened",
    title: "What Happened",
    icon: Activity,
    filter: (item) =>
      item.type === "standup" ||
      item.type === "experiment_update",
    showEmpty: false,
  },
];

/**
 * Badge color and label by item type.
 * Returns { classes, label } for each item's type badge.
 */
function getItemBadge(item) {
  switch (item.type) {
    case "approval":
      return {
        classes: "border-amber-500/20 bg-amber-500/10 text-amber-400",
        label: item.gate || "Approval",
      };
    case "proposed_issue":
      return {
        classes: "border-violet-500/20 bg-violet-500/10 text-violet-400",
        label: "Proposed Issue",
      };
    case "budget":
      return item.severity === "critical"
        ? { classes: "border-red-500/20 bg-red-500/10 text-red-400", label: "Critical" }
        : { classes: "border-amber-500/20 bg-amber-500/10 text-amber-400", label: "Warning" };
    case "stale_task":
      return {
        classes: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
        label: `${item.daysStale || item.days_idle || "?"}d idle`,
      };
    case "overdue_issue":
      return {
        classes: "border-red-500/20 bg-red-500/10 text-red-400",
        label: `Overdue · ${item.days_overdue || "?"}d`,
      };
    case "paused_experiment":
      return {
        classes: "border-orange-500/20 bg-orange-500/10 text-orange-400",
        label: "Paused",
      };
    case "standup":
      return {
        classes: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
        label: "Standup",
      };
    case "experiment_update": {
      const d = (item.decision || "").toLowerCase();
      const colorMap = {
        pivot: "border-amber-500/20 bg-amber-500/10 text-amber-400",
        scale: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
        kill: "border-red-500/20 bg-red-500/10 text-red-400",
        pause: "border-orange-500/20 bg-orange-500/10 text-orange-400",
      };
      return {
        classes: colorMap[d] || "border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
        label: d ? d.charAt(0).toUpperCase() + d.slice(1) : "Update",
      };
    }
    default:
      return { classes: "border-zinc-700/50 bg-zinc-800/50 text-muted-foreground", label: "Item" };
  }
}

/** Row icon by item type — small contextual hint left of the badge */
function getRowIcon(item) {
  switch (item.type) {
    case "approval":
    case "proposed_issue":
      return ShieldCheck;
    case "budget":
      return Wallet;
    case "stale_task":
      return Clock;
    case "overdue_issue":
      return CalendarX;
    case "paused_experiment":
      return FlaskConical;
    case "standup":
      return MessageSquare;
    case "experiment_update":
      return FlaskConical;
    default:
      return Activity;
  }
}

/** Navigate to the right detail page for each item type */
function handleClick(item, navigate) {
  switch (item.type) {
    case "approval":
    case "proposed_issue":
      navigate("approval-detail", item.id);
      break;
    case "budget":
      if (item.project && item.project !== "general") {
        navigate("project-tab", { slug: item.project, tab: "costs" });
      }
      break;
    case "stale_task":
    case "overdue_issue":
      if (item.project && item.project !== "general" && item.id) {
        navigate("issue-detail", { projectSlug: item.project, issueId: item.id });
      }
      break;
    case "paused_experiment":
      if (item.project && item.experiment_dir) {
        navigate("experiment-detail", { slug: item.project, dir: item.experiment_dir });
      }
      break;
    case "standup":
      if (item.project && item.project !== "general") {
        navigate("project-tab", { slug: item.project, tab: "standups" });
      }
      break;
    case "experiment_update":
      if (item.project && item.experiment_dir) {
        navigate("experiment-detail", { slug: item.project, dir: item.experiment_dir });
      }
      break;
  }
}

// --- Section header configs ---
// S1 Decisions: red/amber tinted header (uses section accent, not card tint)
const SECTION_STYLES = {
  decisions: {
    headerClass: "bg-red-500/[0.02] hover:bg-red-500/[0.05]",
    badgeBg: "bg-red-500/10",
    badgeBorder: "border-red-500/20",
    text: "text-red-400",
    titleText: "text-red-100",
    countBg: "bg-red-500/10",
    countBorder: "border-red-500/20",
  },
  risks: {
    headerClass: "bg-amber-500/[0.02] hover:bg-amber-500/[0.05]",
    badgeBg: "bg-amber-500/10",
    badgeBorder: "border-amber-500/20",
    text: "text-amber-400",
    titleText: "text-amber-100",
    countBg: "bg-amber-500/10",
    countBorder: "border-amber-500/20",
  },
  happened: {
    headerClass: "bg-indigo-500/[0.02] hover:bg-indigo-500/[0.05]",
    badgeBg: "bg-indigo-500/10",
    badgeBorder: "border-indigo-500/20",
    text: "text-indigo-400",
    titleText: "text-indigo-100",
    countBg: "bg-indigo-500/10",
    countBorder: "border-indigo-500/20",
  },
};

export default function Briefing({ navigate }) {
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

  // Group items by section
  const grouped = useMemo(() => {
    if (!data?.items) return {};
    const result = {};
    for (const section of SECTIONS) {
      result[section.key] = data.items.filter(section.filter);
    }
    return result;
  }, [data]);

  // Actionable count = S1 (Decisions) + S2 (Risks)
  const actionableCount = useMemo(() => {
    return (grouped.decisions?.length || 0) + (grouped.risks?.length || 0);
  }, [grouped]);

  // S1 has a critical budget item? → red accent, else amber
  const hasCritical = useMemo(() => {
    return (grouped.decisions || []).some(
      (item) => item.type === "budget" && item.severity === "critical"
    );
  }, [grouped]);

  if (loading && !data) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex justify-between items-center mb-1">
          <h1 className="text-[16px] font-semibold uppercase tracking-[0.2em] text-foreground">
            Briefing
          </h1>
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
        <h1 className="text-[16px] font-semibold uppercase tracking-[0.2em] text-foreground">
          Briefing
        </h1>
      </div>
      <p className="text-[14px] text-muted-foreground mb-8">
        {actionableCount} {actionableCount === 1 ? "item needs" : "items need"} your attention
      </p>

      {/* Error */}
      {error && (
        <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-[14px] text-red-400 mb-6">
          {error}
        </div>
      )}

      {/* Sections */}
      <div className="space-y-6 pb-12">
        {SECTIONS.map((section) => {
          const items = grouped[section.key] || [];
          if (items.length === 0 && !section.showEmpty) return null;

          const Icon = section.icon;
          const style = SECTION_STYLES[section.key];
          const isMuted = section.key === "happened";

          // S1 gets elevated card treatment — border-l-2 accent
          const isElevated = section.key === "decisions";
          const accentColor = hasCritical ? "border-l-red-500" : "border-l-amber-500";

          const cardClass = isElevated
            ? `bg-card border border-border rounded-[2px] shadow-sm flex flex-col border-l-2 ${accentColor}`
            : "bg-card border border-border rounded-[2px] shadow-sm flex flex-col";

          return (
            <div key={section.key} className={cardClass}>
              {/* Section header — tinted pattern from DESIGN.md */}
              <div className={`flex items-center gap-3 px-5 py-3 ${style.headerClass} transition-colors`}>
                <div className={`w-6 h-6 rounded-full ${style.badgeBg} border ${style.badgeBorder} flex items-center justify-center`}>
                  <Icon className={`w-3.5 h-3.5 ${style.text}`} />
                </div>
                <div className={`text-[15px] font-medium ${style.titleText}`}>{section.title}</div>
                <div className={`text-[11px] font-mono ${style.countBg} border ${style.countBorder} px-1.5 py-0.5 rounded-[2px] ${style.text}`}>
                  {items.length}
                </div>
              </div>

              {/* Empty state — only S1 shows this */}
              {items.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center">
                  <CheckCircle className="text-emerald-500 w-6 h-6 mb-3" />
                  <span className="text-[14px] text-muted-foreground mb-1">No decisions waiting</span>
                  <span className="text-[12px] text-muted-foreground/60">System stable, agents running</span>
                </div>
              ) : (
                items.map((item, idx) => {
                  const badge = getItemBadge(item);
                  const RowIcon = getRowIcon(item);
                  // S3 rows use muted text to reduce visual weight
                  const titleClass = isMuted
                    ? "text-[14px] text-muted-foreground flex-1 truncate"
                    : "text-[14px] text-foreground flex-1 truncate";

                  return (
                    <div
                      key={item.id || idx}
                      className={`flex items-center gap-4 px-5 py-3 hover:bg-accent/40 cursor-pointer focus-within:bg-accent/40 transition-colors ${
                        idx < items.length - 1 ? "border-b border-border/50" : ""
                      }`}
                      onClick={() => handleClick(item, navigate)}
                    >
                      <RowIcon className="text-muted-foreground w-[18px] h-[18px] flex-shrink-0" />
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-normal border ${badge.classes} flex-shrink-0`}>
                        {badge.label}
                      </span>
                      <span className={titleClass}>{item.title}</span>
                      <span className="text-[12px] text-muted-foreground flex-shrink-0 w-32 truncate hidden sm:block">
                        {item.project && item.project !== "general" ? item.project : item.requester || ""}
                      </span>
                      <span className="text-[12px] font-mono text-muted-foreground/60 w-16 text-right flex-shrink-0">
                        {item.days_overdue
                          ? `${item.days_overdue}d late`
                          : item.daysStale
                            ? `${item.daysStale}d idle`
                            : shortTime(item.timestamp)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
