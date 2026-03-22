import { ArrowLeft, FolderOpen } from "lucide-react";
import { StatusBadge } from "./StatusBadge.jsx";

export function AgentHeader({ agent, navigate }) {
  const statusDot = agent.status === "active" ? "bg-[#22c55e]" : "bg-[#6b7280]";

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="h-12 flex items-center gap-2">
        <button
          onClick={() => navigate("agents")}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          Agents
        </button>
        <span className="text-muted-foreground/40">&rsaquo;</span>
        <span className="text-[13px] font-semibold text-foreground truncate">
          {agent.name}
        </span>
      </div>

      {/* Agent header */}
      <div className="flex items-start gap-4">
        {/* Avatar / Emoji */}
        <div className="flex items-center justify-center h-12 w-12 bg-accent border border-border text-2xl shrink-0">
          {agent.emoji || agent.name?.charAt(0)?.toUpperCase()}
        </div>

        {/* Left: name + role + projects */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-3xl font-semibold text-foreground">{agent.name}</h2>
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {agent.status === "active" ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-50" />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusDot}`} />
                </>
              ) : (
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusDot}`} />
              )}
            </span>
          </div>

          {agent.role && (
            <p className="text-sm text-muted-foreground mb-2">{agent.role}</p>
          )}

          {/* Project assignments */}
          {agent.projects && agent.projects.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {agent.projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate("project", p.id)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <FolderOpen size={12} />
                  {p.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: status badge + metadata */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusBadge status={agent.status} />
          {agent.lastSeen && (
            <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
              Last seen {agent.lastSeen}
            </span>
          )}
          {agent.runCount != null && (
            <span className="text-[11px] text-muted-foreground">
              {agent.runCount} runs
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
