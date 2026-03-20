/**
 * ActivityEvent — single event in the activity timeline.
 */

const EVENT_TYPE_COLORS = {
  issue_update: "bg-blue-500",
  approval_approved: "bg-green-500",
  approval_rejected: "bg-red-500",
  standup: "bg-violet-500",
  project_created: "bg-emerald-500",
  budget_warning: "bg-yellow-500",
  activity: "bg-muted-foreground",
};

const AGENT_COLORS = [
  "bg-pink-600", "bg-indigo-600", "bg-green-600", "bg-purple-600",
  "bg-blue-600", "bg-amber-600", "bg-red-600", "bg-teal-600",
  "bg-cyan-600", "bg-orange-600",
];

function agentColor(name) {
  if (!name) return "bg-muted-foreground";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

function formatTime(isoString) {
  try {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

export function ActivityEvent({ event, onNavigate }) {
  const dotColor = EVENT_TYPE_COLORS[event.type] || EVENT_TYPE_COLORS.activity;

  return (
    <div
      className="flex items-start gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent/30 cursor-default"
    >
      {/* Timeline dot */}
      <div className="flex flex-col items-center shrink-0 pt-1.5">
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      </div>

      {/* Time */}
      <span className="shrink-0 text-xs text-muted-foreground font-mono tabular-nums pt-0.5 w-12">
        {formatTime(event.timestamp)}
      </span>

      {/* Agent badge */}
      {event.agent && (
        <span className="shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium text-white rounded-sm ${agentColor(event.agent)}`}>
            {event.agent}
          </span>
        </span>
      )}

      {/* Description */}
      <span className="flex-1 min-w-0 text-foreground/80 truncate">
        {event.description || event.event || JSON.stringify(event)}
      </span>

      {/* Project tag */}
      {event.project && (
        <span
          className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-accent text-accent-foreground cursor-pointer hover:bg-accent/80"
          onClick={() => onNavigate && onNavigate("project", event.project)}
        >
          {event.project}
        </span>
      )}
    </div>
  );
}
