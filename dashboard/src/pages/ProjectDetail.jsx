import { useState, useEffect } from "react";
import { getFile } from "../api.js";
import { ArrowLeft, FileText, Activity, DollarSign, Clock, User, Wallet, Target } from "lucide-react";
import Markdown from "../components/Markdown.jsx";

const TABS = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "standups", label: "Standups", icon: Activity },
  { id: "costs", label: "Costs", icon: DollarSign },
  { id: "activity", label: "Activity", icon: Clock },
];

const STATUS_COLORS = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  paused: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

function parseProjectMd(raw) {
  if (!raw) return {};
  const titleMatch = raw.match(/^#\s+(.+)/m);
  const leadMatch = raw.match(/\*\*Lead:\*\*\s*(\S+)/);
  const budgetMatch = raw.match(/\*\*Budget:\*\*\s*(.+)/);
  const statusMatch = raw.match(/\*\*Status:\*\*\s*(\S+)/);
  const createdMatch = raw.match(/\*\*Created:\*\*\s*(\S+)/);
  const missionMatch = raw.match(/## Mission\n+([\s\S]*?)(?=\n## |$)/);
  const gatesMatch = raw.match(/## Approval Gates\n+([\s\S]*?)(?=\n## |$)/);
  const subagentsMatch = raw.match(/## Sub-agents\n+([\s\S]*?)(?=\n## |$)/);
  return {
    title: titleMatch?.[1] || "",
    lead: leadMatch?.[1] || "unassigned",
    budget: budgetMatch?.[1]?.trim() || "none",
    status: statusMatch?.[1] || "unknown",
    created: createdMatch?.[1] || "",
    mission: missionMatch?.[1]?.trim() || "",
    gates: gatesMatch?.[1]?.trim() || "",
    subagents: subagentsMatch?.[1]?.trim() || "",
  };
}

function parseActivityLog(raw) {
  if (!raw) return [];
  return raw
    .trim()
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const match = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*\|\s*(\S+)\s*\|\s*(.+)/);
      if (match) return { time: match[1], agent: match[2], event: match[3] };
      return { time: "", agent: "", event: line };
    })
    .reverse();
}

export default function ProjectDetail({ projectId, navigate }) {
  const [tab, setTab] = useState("overview");
  const [projectRaw, setProjectRaw] = useState(null);
  const [milestones, setMilestones] = useState(null);
  const [standups, setStandups] = useState([]);
  const [costs, setCosts] = useState([]);
  const [activityLog, setActivityLog] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getFile(`shared/projects/${projectId}/PROJECT.md`).catch(() => null),
      getFile(`shared/projects/${projectId}/milestones.md`).catch(() => null),
      getFile(`shared/projects/${projectId}/activity.log`).catch(() => null),
      loadStandups(projectId),
      loadCosts(projectId),
    ]).then(([proj, miles, activity, standupList, costList]) => {
      setProjectRaw(proj?.content || null);
      setMilestones(miles?.content || null);
      setActivityLog(activity?.content || "");
      setStandups(standupList);
      setCosts(costList);
      setLoading(false);
    });
  }, [projectId]);

  const project = parseProjectMd(projectRaw);
  const activities = parseActivityLog(activityLog);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500 text-sm">Loading project...</div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate("overview")}
        className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm mb-4 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to projects
      </button>

      {/* Project header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-2xl font-bold text-zinc-100">{project.title || projectId}</h2>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
              STATUS_COLORS[project.status] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
            }`}
          >
            {project.status}
          </span>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
          <span className="flex items-center gap-1.5">
            <User size={14} className="text-zinc-500" />
            {project.lead}
          </span>
          <span className="flex items-center gap-1.5">
            <Wallet size={14} className="text-zinc-500" />
            {project.budget}
          </span>
          {project.created && (
            <span className="flex items-center gap-1.5">
              <Clock size={14} className="text-zinc-500" />
              Created {project.created}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-800">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${
              tab === id
                ? "border-zinc-100 text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="space-y-6">
          {project.mission && (
            <section className="border border-zinc-800 rounded-lg p-5 bg-zinc-900">
              <div className="flex items-center gap-2 mb-3">
                <Target size={16} className="text-zinc-500" />
                <h3 className="text-sm font-semibold text-zinc-300">Mission</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{project.mission}</p>
            </section>
          )}

          {milestones && (
            <section className="border border-zinc-800 rounded-lg p-5 bg-zinc-900">
              <h3 className="text-sm font-semibold text-zinc-300 mb-3">Milestones</h3>
              <Markdown content={milestones} />
            </section>
          )}

          {project.gates && (
            <section className="border border-zinc-800 rounded-lg p-5 bg-zinc-900">
              <h3 className="text-sm font-semibold text-zinc-300 mb-3">Approval Gates</h3>
              <div className="space-y-1.5">
                {project.gates.split("\n").filter(Boolean).map((gate, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60 shrink-0" />
                    <span className="text-zinc-400">{gate.replace(/^-\s*/, "")}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {project.subagents && !project.subagents.includes("(none") && (
            <section className="border border-zinc-800 rounded-lg p-5 bg-zinc-900">
              <h3 className="text-sm font-semibold text-zinc-300 mb-3">Sub-agents</h3>
              <Markdown content={project.subagents} />
            </section>
          )}
        </div>
      )}

      {/* Standups tab */}
      {tab === "standups" && (
        <div className="space-y-4">
          {standups.length === 0 ? (
            <EmptyState text="No standups yet. The lead will post daily updates here." />
          ) : (
            standups.map((s) => (
              <div
                key={s.name}
                className="border border-zinc-800 rounded-lg p-5 bg-zinc-900"
              >
                <h4 className="text-sm font-semibold text-zinc-300 mb-3">
                  {s.name.replace(".md", "")}
                </h4>
                <Markdown content={s.content} />
              </div>
            ))
          )}
        </div>
      )}

      {/* Costs tab */}
      {tab === "costs" && (
        <div className="space-y-4">
          {costs.length === 0 ? (
            <EmptyState text="No cost data yet. Agents will log their token usage here." />
          ) : (
            <>
              <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-zinc-300">Total Spend</h3>
                  <span className="text-xl font-mono text-emerald-400">
                    ${costs.reduce((sum, c) => sum + (c.total_usd || 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>
              {costs.map((c) => (
                <div
                  key={c.agent}
                  className="border border-zinc-800 rounded-lg p-4 bg-zinc-900"
                >
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-semibold text-zinc-300">{c.agent}</h4>
                    <span className="text-sm font-mono text-emerald-400">
                      ${c.total_usd?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                  {c.entries && c.entries.length > 0 && (
                    <div className="text-xs space-y-1.5 border-t border-zinc-800 pt-3">
                      {c.entries.slice(-5).map((e, i) => (
                        <div key={i} className="flex justify-between text-zinc-500">
                          <span className="truncate mr-4">{e.task}</span>
                          <span className="font-mono shrink-0">
                            {e.type === "claude-code" ? (
                              <span className="text-blue-400">CC free</span>
                            ) : (
                              `$${e.cost_usd?.toFixed(2)}`
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Activity tab */}
      {tab === "activity" && (
        <div>
          {activities.length === 0 ? (
            <EmptyState text="No activity logged yet." />
          ) : (
            <div className="space-y-0">
              {activities.map((a, i) => (
                <div
                  key={i}
                  className="flex gap-4 py-3 border-b border-zinc-800/50 last:border-0"
                >
                  <div className="shrink-0 w-32 text-xs text-zinc-600 font-mono pt-0.5">
                    {a.time}
                  </div>
                  <div className="shrink-0">
                    <span className="inline-block px-2 py-0.5 text-xs font-medium text-zinc-400 bg-zinc-800 rounded">
                      {a.agent}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-400">{a.event}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="border border-dashed border-zinc-700 rounded-lg p-8 text-center">
      <p className="text-zinc-500 text-sm">{text}</p>
    </div>
  );
}

async function loadStandups(projectId) {
  try {
    const dir = await getFile(`shared/projects/${projectId}/standups`);
    if (dir.type !== "directory" || !dir.entries) return [];
    const files = dir.entries.filter((e) => e.type === "file" && e.name.endsWith(".md"));
    const results = await Promise.all(
      files
        .sort((a, b) => b.name.localeCompare(a.name))
        .slice(0, 7)
        .map(async (f) => {
          const data = await getFile(`shared/projects/${projectId}/standups/${f.name}`);
          return { name: f.name, content: data.content || "" };
        })
    );
    return results;
  } catch {
    return [];
  }
}

async function loadCosts(projectId) {
  try {
    const dir = await getFile(`shared/projects/${projectId}/costs`);
    if (dir.type !== "directory" || !dir.entries) return [];
    const files = dir.entries.filter((e) => e.type === "file" && e.name.endsWith(".json"));
    const results = await Promise.all(
      files.map(async (f) => {
        const data = await getFile(`shared/projects/${projectId}/costs/${f.name}`);
        return data.content || {};
      })
    );
    return results;
  } catch {
    return [];
  }
}
