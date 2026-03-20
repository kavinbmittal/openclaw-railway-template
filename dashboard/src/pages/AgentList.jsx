import { useState, useEffect } from "react";
import { getFile } from "../api.js";
import { MetricCard } from "../components/MetricCard.jsx";
import { Badge } from "../components/ui/Badge.jsx";

const AGENTS = [
  { name: "Sam", workspace: "workspace", role: "Cross-project coordinator", canLead: false },
  { name: "Binny", workspace: "workspace-binny", role: "Lia PM", canLead: true },
  { name: "EJ", workspace: "workspace-ej", role: "Engineering", canLead: false },
  { name: "Kiko", workspace: "workspace-kiko", role: "Celestial PM, Design", canLead: true },
  { name: "Leslie", workspace: "workspace-leslie-marketer", role: "Growth, Outreach", canLead: true },
  { name: "Zara", workspace: "workspace-zara-design", role: "Design, UX, Research", canLead: true },
  { name: "Ritam", workspace: "workspace-ritam", role: "Researcher", canLead: true },
  { name: "Jon", workspace: "workspace-jon-appideas", role: "Apps Research", canLead: false },
  { name: "Midas", workspace: "workspace-midas", role: "Crypto", canLead: true },
];

export default function AgentList() {
  const [tasks, setTasks] = useState({});

  useEffect(() => {
    AGENTS.forEach((agent) => {
      getFile(`${agent.workspace}/memory/active-tasks.md`)
        .then((data) => setTasks((prev) => ({ ...prev, [agent.name]: data.content || "" })))
        .catch(() => setTasks((prev) => ({ ...prev, [agent.name]: null })));
    });
  }, []);

  const leads = AGENTS.filter((a) => a.canLead);
  const specialists = AGENTS.filter((a) => !a.canLead);

  return (
    <div className="space-y-6">
      {/* Breadcrumb bar */}
      <div className="h-12 flex items-center">
        <h1 className="text-sm font-semibold uppercase tracking-wider">Agents</h1>
      </div>

      {/* Metric row */}
      <div className="grid grid-cols-3 gap-1">
        <MetricCard label="Total" value={AGENTS.length} />
        <MetricCard label="Can Lead" value={leads.length} />
        <MetricCard label="Specialists" value={specialists.length} />
      </div>

      {/* Project leads */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Project Leads
        </h3>
        <div className="border border-border divide-y divide-border">
          {leads.map((agent) => (
            <AgentRow key={agent.name} agent={agent} tasks={tasks[agent.name]} />
          ))}
        </div>
      </div>

      {/* Specialists */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Specialists
        </h3>
        <div className="border border-border divide-y divide-border">
          {specialists.map((agent) => (
            <AgentRow key={agent.name} agent={agent} tasks={tasks[agent.name]} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentRow({ agent, tasks }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 px-4 py-2.5 text-sm w-full text-left transition-colors hover:bg-accent/50"
      >
        {/* Status dot */}
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
        </span>

        {/* Name */}
        <span className="font-medium text-foreground w-20 shrink-0">{agent.name}</span>

        {/* Role */}
        <span className="text-xs text-muted-foreground flex-1 truncate">{agent.role}</span>

        {/* Lead badge */}
        {agent.canLead && (
          <Badge variant="secondary" className="shrink-0">
            lead
          </Badge>
        )}

        {/* Expand indicator */}
        <span className="text-muted-foreground/50 text-xs shrink-0">
          {tasks !== undefined ? (expanded ? "\u25BE" : "\u25B8") : ""}
        </span>
      </button>

      {expanded && tasks !== undefined && (
        <div className="px-4 pb-3 pt-0">
          {tasks ? (
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/30 p-3 max-h-48 overflow-y-auto scrollbar-auto-hide">
              {tasks.slice(0, 800)}
              {tasks.length > 800 ? "\n..." : ""}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground/60 py-2">No active tasks file</p>
          )}
        </div>
      )}
    </div>
  );
}
