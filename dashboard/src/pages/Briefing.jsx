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
  UserCheck,
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
      item.type === "budget" ||
      item.type === "blocked_on_operator",
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
    case "blocked_on_operator": {
      const d = item.days_blocked;
      // Show hours if < 1 day, days otherwise
      const timeStr = d >= 1 ? `${d}d` : shortTime(item.blocked_at) || "<1h";
      return {
        classes: "border-orange-500/20 bg-orange-500/10 text-orange-400",
        label: `Waiting · ${timeStr}`,
      };
    }
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

/** Row icon by item type */
function getRowIcon(item) {
  switch (item.type) {
    case "approval":
    case "proposed_issue":
      return ShieldCheck;
    case "budget":
      return Wallet;
    case "blocked_on_operator":
      return UserCheck;
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
    case "blocked_on_operator":
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

/**
 * Groups items by project, sorted by urgency (oldest item first).
 * Returns array of { project, items } objects.
 */
function groupByProject(items) {
  const byProject = {};
  for (const item of items) {
    const proj = item.project && item.project !== "general" ? item.project : "General";
    if (!byProject[proj]) byProject[proj] = [];
    byProject[proj].push(item);
  }

  // Sort items within each project by age (oldest first)
  for (const proj of Object.keys(byProject)) {
    byProject[proj].sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
  }

  // Sort projects by their oldest item (most urgent project first)
  return Object.entries(byProject)
    .map(([project, items]) => ({ project, items }))
    .sort((a, b) => (a.items[0]?.timestamp || "").localeCompare(b.items[0]?.timestamp || ""));
}

// --- Section header configs ---
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

/** Right-side time display — contextual per item type */
function timeDisplay(item) {
  if (item.days_blocked != null && item.days_blocked >= 1) return `${item.days_blocked}d`;
  if (item.days_overdue) return `${item.days_overdue}d late`;
  if (item.daysStale) return `${item.daysStale}d idle`;
  return shortTime(item.timestamp);
}

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

  // Group items by section, then by project within each section
  const grouped = useMemo(() => {
    if (!data?.items) return {};
    const result = {};
    for (const section of SECTIONS) {
      const sectionItems = data.items.filter(section.filter);
      result[section.key] = {
        items: sectionItems,
        byProject: groupByProject(sectionItems),
      };
    }
    return result;
  }, [data]);

  // Actionable count = S1 (Decisions) + S2 (Risks)
  const actionableCount = useMemo(() => {
    return (grouped.decisions?.items?.length || 0) + (grouped.risks?.items?.length || 0);
  }, [grouped]);

  // S1 has a critical budget item? → red accent, else amber
  const hasCritical = useMemo(() => {
    return (grouped.decisions?.items || []).some(
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
          const sectionData = grouped[section.key] || { items: [], byProject: [] };
          const { items, byProject } = sectionData;
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
                /* Project-grouped items */
                byProject.map((group, groupIdx) => (
                  <div key={group.project}>
                    {/* Project sub-header — lightweight grouping line */}
                    <div className={`flex items-center justify-between px-5 py-2 ${groupIdx > 0 ? "border-t border-border/50" : ""}`}>
                      <span className="text-[13px] font-mono uppercase tracking-[0.1em] text-muted-foreground">
                        {group.project}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground/50">
                        {group.items.length}
                      </span>
                    </div>

                    {/* Items within this project */}
                    {group.items.map((item, idx) => {
                      const badge = getItemBadge(item);
                      const RowIcon = getRowIcon(item);
                      const titleClass = isMuted
                        ? "text-[14px] text-muted-foreground flex-1 truncate"
                        : "text-[14px] text-foreground flex-1 truncate";

                      return (
                        <div
                          key={item.id || `${groupIdx}-${idx}`}
                          className={`flex items-center gap-4 px-5 py-3 hover:bg-accent/40 cursor-pointer focus-within:bg-accent/40 transition-colors ${
                            idx < group.items.length - 1 ? "border-b border-border/30" : ""
                          }`}
                          onClick={() => handleClick(item, navigate)}
                        >
                          <RowIcon className="text-muted-foreground w-[18px] h-[18px] flex-shrink-0" />
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-normal border ${badge.classes} flex-shrink-0`}>
                            {badge.label}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className={titleClass}>{item.title}</span>
                            {/* Blocker reason — visible inline beneath title */}
                            {item.type === "blocked_on_operator" && item.blocked_reason && (
                              <div className="text-[12px] text-muted-foreground/70 truncate mt-0.5">
                                {item.blocked_reason}
                              </div>
                            )}
                          </div>
                          <span className="text-[12px] text-muted-foreground flex-shrink-0 w-28 truncate hidden sm:block text-right">
                            {item.assignee || item.requester || ""}
                          </span>
                          <span className="text-[12px] font-mono text-muted-foreground/60 w-16 text-right flex-shrink-0">
                            {timeDisplay(item)}
                          </span>
                        </div>
                      );
                    })}
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
