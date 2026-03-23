/**
 * EditProject — form for editing an existing project.
 * Mirrors CreateProject layout, pre-populates from PROJECT.md.
 */
import { useState, useEffect, useRef } from "react";
import { getFile, updateProject } from "../api.js";
import { Loader2, FolderOpen } from "lucide-react";
import { Skeleton } from "../components/ui/Skeleton.jsx";

const LEADS = [
  { id: "binny", label: "Binny — Lia PM" },
  { id: "kiko", label: "Kiko — Celestial PM, Design" },
  { id: "leslie", label: "Leslie — Growth, Outreach" },
  { id: "zara", label: "Zara — Design, UX, Research" },
  { id: "ritam", label: "Ritam — Researcher" },
  { id: "midas", label: "Midas — Crypto" },
];

const DEFAULT_GATES = [
  { id: "deploy-production", label: "Deploy to production" },
  { id: "scope-change", label: "Scope changes" },
  { id: "external-integration", label: "External integrations" },
  { id: "autoresearch-start", label: "Start autoresearch experiment" },
  { id: "single-task-over-50", label: "Single task over $50" },
];

// Parse PROJECT.md into form fields
function parseProjectMd(raw) {
  const titleMatch = raw.match(/^#\s+(.+)/m);
  const leadMatch = raw.match(/\*\*Lead:\*\*\s*(\S+)/);
  const budgetMatch = raw.match(/\*\*Budget:\*\*\s*\$?(\d+)/);
  const statusMatch = raw.match(/\*\*Status:\*\*\s*(\S+)/);
  const nsmMatch = raw.match(/\*\*NSM:\*\*\s*(.+)/);
  const workdirMatch = raw.match(/\*\*Workdir:\*\*\s*(.+)/);
  const missionMatch = raw.match(/## Mission\s*(?:\/\s*Goal)?\n+([\s\S]*?)(?=\n## |$)/);
  const gatesMatch = raw.match(/## Approval Gates\n([\s\S]*?)(?=\n## |$)/);

  // Parse which gates are enabled
  const enabledGates = new Set();
  if (gatesMatch) {
    const lines = gatesMatch[1].split("\n").filter((l) => l.startsWith("- "));
    for (const line of lines) {
      const id = line.replace(/^- /, "").split(":")[0].trim();
      enabledGates.add(id);
    }
  }

  return {
    name: titleMatch?.[1] || "",
    lead: leadMatch?.[1] || "",
    budget: budgetMatch?.[1] || "200",
    status: statusMatch?.[1] || "active",
    nsm: nsmMatch?.[1]?.trim() || "",
    workdir: workdirMatch?.[1]?.trim() || "",
    mission: missionMatch?.[1]?.trim() || "",
    gates: DEFAULT_GATES.map((g) => ({ ...g, checked: enabledGates.has(g.id) })),
  };
}

export default function EditProject({ projectSlug, navigate }) {
  const [name, setName] = useState("");
  const [mission, setMission] = useState("");
  const [nsm, setNsm] = useState("");
  const [lead, setLead] = useState("");
  const [status, setStatus] = useState("active");
  const [budget, setBudget] = useState("500");
  const [workdir, setWorkdir] = useState("");
  const [gates, setGates] = useState(DEFAULT_GATES.map((g) => ({ ...g, checked: false })));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Snapshot for change detection
  const originalRef = useRef(null);

  useEffect(() => {
    getFile(`shared/projects/${projectSlug}/PROJECT.md`)
      .then((data) => {
        const parsed = parseProjectMd(data.content || "");
        setName(parsed.name);
        setMission(parsed.mission);
        setNsm(parsed.nsm);
        setLead(parsed.lead);
        setStatus(parsed.status);
        setBudget(parsed.budget);
        setWorkdir(parsed.workdir);
        setGates(parsed.gates);
        originalRef.current = JSON.stringify(parsed);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectSlug]);

  // Track changes
  useEffect(() => {
    if (!originalRef.current) return;
    const current = JSON.stringify({ name, mission, nsm, lead, status, budget, workdir, gates });
    const original = originalRef.current;
    // Compare parsed values (not exact JSON since gates structure differs)
    setHasChanges(current !== original);
  }, [name, mission, nsm, lead, status, budget, workdir, gates]);

  function toggleGate(id) {
    setGates((prev) =>
      prev.map((g) => (g.id === id ? { ...g, checked: !g.checked } : g))
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !mission.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      await updateProject(projectSlug, {
        name: name.trim(),
        mission: mission.trim(),
        nsm: nsm.trim() || null,
        lead: lead || "binny",
        budget: parseInt(budget) || 200,
        status,
        workdir: workdir.trim() || null,
        gates,
      });
      navigate("project", projectSlug);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <header className="px-8 py-8 border-b border-border shrink-0 bg-background">
          <Skeleton className="h-4 w-48 mb-5" />
          <Skeleton className="h-8 w-64" />
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto">
            <Skeleton className="h-[600px] w-full rounded-[2px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-8 py-8 border-b border-border shrink-0 bg-background">
        {/* Breadcrumb */}
        <nav className="flex items-center text-[15px] text-zinc-400 mb-5 tracking-wide">
          <a href="#/overview" onClick={(e) => { e.preventDefault(); navigate("overview"); }} className="hover:text-zinc-200 transition-colors cursor-pointer">Projects</a>
          <span className="mx-2 text-zinc-600">&rsaquo;</span>
          <a href={`#/projects/${projectSlug}`} onClick={(e) => { e.preventDefault(); navigate("project", projectSlug); }} className="hover:text-zinc-200 transition-colors cursor-pointer capitalize">{projectSlug}</a>
          <span className="mx-2 text-zinc-600">&rsaquo;</span>
          <span className="text-zinc-100 font-semibold">Edit</span>
        </nav>

        {/* Page Header */}
        <h1 className="text-[30px] font-semibold text-zinc-100 leading-none tracking-tight">
          Edit Project
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl w-full mx-auto">

          {/* Form Card */}
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-[2px] shadow-sm flex flex-col relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />

            {/* Card Header */}
            <div className="flex items-center gap-3 px-5 py-3 bg-indigo-500/[0.02] transition-colors">
              <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="text-[15px] font-medium text-indigo-100">Project Details</div>
            </div>

            {/* Form Body */}
            <div className="p-[20px] space-y-6">

              {/* Project Name */}
              <div>
                <label className="block text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2">Project Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. API Gateway v2"
                  required
                  className="w-full rounded-[6px] border border-border bg-background text-[14px] text-foreground px-3 py-2 placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-shadow"
                />
              </div>

              {/* Slug — read-only */}
              <div>
                <label className="block text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2">Project ID / Slug</label>
                <input
                  type="text"
                  value={projectSlug}
                  disabled
                  className="w-full rounded-[6px] border border-border bg-zinc-900/50 text-[14px] text-muted-foreground px-3 py-2 font-mono cursor-not-allowed"
                />
                <span className="block text-[12px] text-muted-foreground mt-1.5">Cannot be changed — used in file paths and URLs.</span>
              </div>

              {/* Mission / Goal */}
              <div>
                <label className="block text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2">Mission / Goal</label>
                <textarea
                  value={mission}
                  onChange={(e) => setMission(e.target.value)}
                  rows={4}
                  placeholder="What is this project trying to achieve?"
                  required
                  className="w-full rounded-[6px] border border-border bg-background text-[14px] text-foreground px-3 py-2 placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-shadow resize-y"
                />
              </div>

              {/* North Star Metric */}
              <div>
                <label className="block text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2">North Star Metric</label>
                <input
                  type="text"
                  value={nsm}
                  onChange={(e) => setNsm(e.target.value)}
                  placeholder="e.g., Paying customers with >7 day retention"
                  className="w-full rounded-[6px] border border-border bg-background text-[14px] text-foreground px-3 py-2 placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-shadow"
                />
                <span className="block text-[12px] text-muted-foreground mt-1.5">How you measure progress. Combine quantity and quality.</span>
              </div>

              {/* Two-column: Lead Agent + Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Lead Agent */}
                <div>
                  <label className="block text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2">Lead Agent</label>
                  <div className="relative group">
                    <select
                      value={lead}
                      onChange={(e) => setLead(e.target.value)}
                      className="w-full rounded-[6px] border border-border bg-background text-[14px] text-foreground px-3 py-2 pr-10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-shadow cursor-pointer appearance-none"
                    >
                      <option value="" disabled>Select an agent...</option>
                      {LEADS.map((l) => (
                        <option key={l.id} value={l.id}>{l.label}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground group-hover:text-foreground transition-colors">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                  <span className="block text-[12px] text-muted-foreground mt-1.5">Which agent owns this project?</span>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2">Status</label>
                  <div className="relative group">
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full rounded-[6px] border border-border bg-background text-[14px] text-foreground px-3 py-2 pr-10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-shadow cursor-pointer appearance-none"
                    >
                      <option value="active">Active</option>
                      <option value="planned">Planned</option>
                      <option value="paused">Paused</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground group-hover:text-foreground transition-colors">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekly Budget */}
              <div>
                <label className="block text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2">Weekly Budget</label>
                <div className="relative max-w-[240px]">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground text-[14px]">$</div>
                  <input
                    type="text"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="100"
                    className="w-full rounded-[6px] border border-border bg-background text-[14px] text-foreground pl-7 pr-3 py-2 placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-shadow font-mono tabular-nums"
                  />
                </div>
                <span className="block text-[12px] text-muted-foreground mt-1.5">Weekly spend limit in USD</span>
              </div>

              {/* Working Directory */}
              <div>
                <label className="block text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2">Working Directory</label>
                <input
                  type="text"
                  value={workdir}
                  onChange={(e) => setWorkdir(e.target.value)}
                  placeholder="/Users/kbm/Repos/project-name"
                  className="w-full rounded-[6px] border border-border bg-background text-[14px] text-foreground px-3 py-2 placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-shadow font-mono"
                />
                <span className="block text-[12px] text-muted-foreground mt-1.5">Local path where Claude Code executes tasks for this project</span>
              </div>

              {/* Approval Gates */}
              <div>
                <label className="block text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2">Approval Gates</label>
                <div className="border border-border rounded-[2px] divide-y divide-border">
                  {gates.map((gate) => (
                    <label
                      key={gate.id}
                      className="flex items-center gap-3 px-4 py-2.5 text-[14px] cursor-pointer hover:bg-accent/30 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={gate.checked}
                        onChange={() => toggleGate(gate.id)}
                        className="accent-foreground"
                      />
                      <span className="text-foreground/80">{gate.label}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground font-mono">requires kavin</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mx-[20px] mb-4 border border-red-500/20 bg-red-500/5 rounded-[2px] px-4 py-3 text-[15px] text-red-400">
                {error}
              </div>
            )}

            {/* Card Footer */}
            <div className="p-[20px] border-t border-border bg-card flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate("project", projectSlug)}
                className="px-4 py-2 rounded-[6px] border border-border bg-card text-[15px] font-medium text-foreground/80 hover:bg-accent hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !name.trim() || !mission.trim() || !hasChanges}
                className="px-4 py-2 rounded-[6px] border border-emerald-500/50 bg-emerald-500/10 text-[15px] font-medium text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
