/**
 * EditIssue — form page for editing an existing issue.
 * UI classes ported directly from Aura HTML reference.
 */
import { useState, useEffect, useRef } from "react";
import { Bold, Italic, Link, Code, ChevronDown, Trash2, Check, Pencil as PencilIcon } from "lucide-react";
import { getIssue, updateIssue, deleteIssue, getThemes } from "../api.js";
import { AGENTS } from "../components/AssigneeSelect.jsx";
import { ALL_PRIORITIES } from "../components/PriorityIcon.jsx";
import { formatTimeAgo } from "../utils/formatDate.js";

const PRIORITY_DOTS = { critical: "bg-red-500", high: "bg-orange-500", medium: "bg-blue-500", low: "bg-zinc-500", none: "" };

// Status badge color map matching Aura HTML
const STATUS_COLORS = {
  proposed: "border-violet-500/30 bg-violet-500/10 text-violet-400",
  backlog: "border-zinc-700/50 bg-zinc-800/50 text-zinc-400",
  todo: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  in_progress: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  in_review: "border-violet-500/30 bg-violet-500/10 text-violet-400",
  blocked: "border-red-500/30 bg-red-500/10 text-red-400",
  done: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  cancelled: "border-zinc-700/50 bg-zinc-800/50 text-zinc-400",
};
const STATUS_DOT = {
  proposed: "bg-violet-400",
  backlog: "bg-zinc-400",
  todo: "bg-blue-400",
  in_progress: "bg-blue-400 animate-pulse",
  in_review: "bg-violet-400",
  blocked: "bg-red-400",
  done: "bg-emerald-400",
  cancelled: "bg-zinc-400",
};

export default function EditIssue({ projectSlug, issueId, navigate }) {
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("none");
  const [assignee, setAssignee] = useState("");
  const [theme, setTheme] = useState("");
  const [selectedMetrics, setSelectedMetrics] = useState(new Set());
  const [labels, setLabels] = useState("");
  const [status, setStatus] = useState("");
  const [complexity, setComplexity] = useState("complex");
  const [escalationCount, setEscalationCount] = useState(0);
  const [budget, setBudget] = useState("");

  // Data state
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Original values for change detection
  const originalRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getIssue(issueId, projectSlug),
      getThemes(projectSlug).catch(() => []),
    ])
      .then(([issue, themeList]) => {
        setTitle(issue.title || "");
        setDescription(issue.description || "");
        setPriority(issue.priority || "none");
        setAssignee(issue.assignee || "");
        setTheme(issue.theme || "");
        setStatus(issue.status || "");
        setLabels((issue.labels || []).join(", "));
        setComplexity(issue.complexity || "operator");
        setEscalationCount(issue.escalation_count || 0);
        setBudget(issue.budget != null ? String(issue.budget) : "");
        const metricIds = (issue.proxy_metrics || []).map((pm) =>
          typeof pm === "string" ? pm : pm.id
        );
        setSelectedMetrics(new Set(metricIds));
        setThemes(themeList);

        originalRef.current = {
          title: issue.title || "",
          description: issue.description || "",
          priority: issue.priority || "none",
          assignee: issue.assignee || "",
          theme: issue.theme || "",
          labels: (issue.labels || []).join(", "),
          complexity: issue.complexity || "operator",
          budget: issue.budget != null ? String(issue.budget) : "",
          metrics: new Set(metricIds),
          updated: issue.updated,
        };
      })
      .catch((err) => console.error("Failed to load issue:", err))
      .finally(() => setLoading(false));
  }, [issueId, projectSlug]);

  // Track changes against original values
  useEffect(() => {
    if (!originalRef.current) return;
    const o = originalRef.current;
    const metricsChanged =
      selectedMetrics.size !== o.metrics.size ||
      [...selectedMetrics].some((m) => !o.metrics.has(m));
    const changed =
      title !== o.title ||
      description !== o.description ||
      priority !== o.priority ||
      assignee !== o.assignee ||
      theme !== o.theme ||
      labels !== o.labels ||
      complexity !== o.complexity ||
      budget !== o.budget ||
      metricsChanged;
    setHasChanges(changed);
  }, [title, description, priority, assignee, theme, selectedMetrics, labels, complexity, budget]);

  // Get proxy metrics for the currently selected theme
  const currentTheme = themes.find((t) => t.id === theme || t.title === theme);
  const themeMetrics = currentTheme
    ? (currentTheme.proxy_metrics || []).sort(
        (a, b) => (a.order ?? 999) - (b.order ?? 999)
      )
    : [];

  // When theme changes, reset selected metrics
  function handleThemeChange(newTheme) {
    setTheme(newTheme);
    setSelectedMetrics(new Set());
  }

  function toggleMetric(metricId) {
    setSelectedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(metricId)) next.delete(metricId);
      else next.add(metricId);
      return next;
    });
  }

  async function handleSave() {
    if (!hasChanges || saving) return;
    setSaving(true);
    try {
      await updateIssue(issueId, projectSlug, {
        title,
        description,
        priority,
        assignee: assignee || null,
        theme: theme || null,
        proxy_metrics: [...selectedMetrics],
        labels: labels
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        complexity,
        budget: budget ? parseFloat(budget) : null,
      });
      navigate("issue-detail", { projectSlug, issueId });
    } catch (err) {
      console.error("Failed to save issue:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this issue? This action cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteIssue(issueId, projectSlug);
      navigate("project-tab", { slug: projectSlug, tab: "issues" });
    } catch (err) {
      console.error("Failed to delete issue:", err);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <header className="sticky top-0 z-10 px-8 py-8 border-b border-border shrink-0 bg-background/80 backdrop-blur-sm flex flex-col gap-4">
          <div className="text-[14px] text-zinc-400 tracking-wide flex items-center flex-wrap">
            <span className="text-zinc-500">Loading...</span>
          </div>
          <div className="flex items-end gap-3">
            <h1 className="text-3xl font-semibold text-zinc-100 leading-none tracking-tight">Edit Issue</h1>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-[800px] mx-auto w-full bg-card border border-border rounded-[2px] shadow-sm p-[20px]">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-zinc-800 rounded w-1/3"></div>
              <div className="h-10 bg-zinc-800 rounded"></div>
              <div className="h-4 bg-zinc-800 rounded w-1/4"></div>
              <div className="h-32 bg-zinc-800 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusLabel = (status || "unknown").replace(/_/g, " ");
  const statusColors = STATUS_COLORS[status] || "border-zinc-700/50 bg-zinc-800/50 text-zinc-400";
  const statusDot = STATUS_DOT[status] || "bg-zinc-400";
  const approvedThemes = themes.filter((t) => t.status === "approved").sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Page Header */}
      <header className="sticky top-0 z-10 px-8 py-8 border-b border-border shrink-0 bg-background/80 backdrop-blur-sm flex flex-col gap-4">
        {/* Breadcrumb */}
        <div className="text-[14px] text-zinc-400 tracking-wide flex items-center flex-wrap">
          <a
            href="#/overview"
            onClick={(e) => { e.preventDefault(); navigate("overview"); }}
            className="hover:text-zinc-200 transition-colors"
          >
            Projects
          </a>
          <span className="mx-2 text-zinc-600">&rsaquo;</span>
          <a
            href={`#/projects/${projectSlug}`}
            onClick={(e) => { e.preventDefault(); navigate("project", projectSlug); }}
            className="hover:text-zinc-200 transition-colors capitalize"
          >
            {projectSlug}
          </a>
          <span className="mx-2 text-zinc-600">&rsaquo;</span>
          <a
            href={`#/projects/${projectSlug}/issues`}
            onClick={(e) => { e.preventDefault(); navigate("project-tab", { slug: projectSlug, tab: "issues" }); }}
            className="hover:text-zinc-200 transition-colors"
          >
            Issues
          </a>
          <span className="mx-2 text-zinc-600">&rsaquo;</span>
          <a
            href={`#/projects/${projectSlug}/issues/${issueId}`}
            onClick={(e) => { e.preventDefault(); navigate("issue-detail", { projectSlug, issueId }); }}
            className="text-zinc-300 hover:text-zinc-100 transition-colors font-mono"
          >
            {issueId}
          </a>
          <span className="mx-2 text-zinc-600">&rsaquo;</span>
          <span className="text-zinc-100 font-medium">Edit</span>
        </div>

        {/* Title Area */}
        <div className="flex items-end gap-3">
          <h1 className="text-3xl font-semibold text-zinc-100 leading-none tracking-tight">Edit Issue</h1>
          <span className="text-[14px] font-mono text-zinc-500 mb-0.5">{issueId}</span>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* Form Card */}
        <form
          className="max-w-[800px] mx-auto w-full bg-card border border-border rounded-[2px] shadow-sm flex flex-col relative overflow-hidden"
          onSubmit={(e) => { e.preventDefault(); handleSave(); }}
        >
          {/* Subtle top highlight */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent"></div>

          {/* Card Header */}
          <div className="flex items-center gap-3 px-5 py-3 bg-indigo-500/[0.02] transition-colors">
            <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <PencilIcon className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-[15px] font-medium text-indigo-100 flex-1">Issue Details</div>
            <span className={`px-2.5 py-1 rounded-full text-[12px] font-medium border ${statusColors} flex items-center gap-1.5 shadow-sm`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`}></span>
              {statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}
            </span>
          </div>

          {/* Form Body */}
          <div className="p-[20px] space-y-6">
            {/* Title Field */}
            <div>
              <label className="block text-[12px] font-medium text-zinc-400 mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-background border border-border rounded-[6px] px-3 py-2 text-[14px] text-zinc-200 placeholder:text-zinc-600 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-[color,box-shadow] shadow-sm"
                placeholder="Issue title"
              />
            </div>

            {/* Description Field with Markdown Toolbar */}
            <div>
              <label className="block text-[12px] font-medium text-zinc-400 mb-2">Description</label>
              <div className="border border-border rounded-[6px] overflow-hidden shadow-sm focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600 transition-all bg-background">
                {/* Toolbar */}
                <div className="bg-zinc-900/50 border-b border-border px-3 py-1.5 flex items-center gap-1">
                  <button type="button" onClick={() => setDescription((d) => d + "**bold**")} className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors flex items-center justify-center">
                    <Bold size={16} />
                  </button>
                  <button type="button" onClick={() => setDescription((d) => d + "*italic*")} className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors flex items-center justify-center">
                    <Italic size={16} />
                  </button>
                  <div className="w-[1px] h-4 bg-zinc-700 mx-1"></div>
                  <button type="button" onClick={() => setDescription((d) => d + "[link](url)")} className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors flex items-center justify-center">
                    <Link size={16} />
                  </button>
                  <button type="button" onClick={() => setDescription((d) => d + "`code`")} className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors flex items-center justify-center">
                    <Code size={16} />
                  </button>
                </div>
                {/* Textarea */}
                <textarea
                  rows="6"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-transparent px-3 py-2 text-[14px] text-zinc-200 placeholder:text-zinc-600 outline-none resize-y min-h-[120px]"
                  placeholder="Describe the issue..."
                />
              </div>
            </div>

            {/* Two-column row: Priority & Assignee */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Priority */}
              <div>
                <label className="block text-[12px] font-medium text-zinc-400 mb-2">Priority</label>
                <div className="relative">
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full appearance-none bg-background border border-border rounded-[6px] px-3 py-2 pr-10 text-[14px] text-zinc-200 shadow-sm hover:border-zinc-700 transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {ALL_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-[12px] font-medium text-zinc-400 mb-2">Assignee</label>
                <div className="relative">
                  <select
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    className="w-full appearance-none bg-background border border-border rounded-[6px] px-3 py-2 pr-10 text-[14px] text-zinc-200 shadow-sm hover:border-zinc-700 transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option value="">Unassigned</option>
                    {AGENTS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>
            </div>

            {/* Theme */}
            <div className="w-full md:w-1/2 pr-0 md:pr-3">
              <label className="block text-[12px] font-medium text-zinc-400 mb-2">Theme</label>
              <div className="relative">
                <select
                  value={theme}
                  onChange={(e) => handleThemeChange(e.target.value)}
                  className="w-full appearance-none bg-background border border-border rounded-[6px] px-3 py-2 pr-10 text-[14px] text-zinc-200 shadow-sm hover:border-zinc-700 transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="">No theme</option>
                  {approvedThemes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
                  <ChevronDown size={16} />
                </div>
              </div>
              <p className="text-[12px] text-zinc-500 mt-2">Tag this issue to a strategic theme</p>
            </div>

            {/* Proxy Metrics */}
            {themeMetrics.length > 0 && (
              <div>
                <label className="block text-[12px] font-medium text-zinc-400 mb-2">Proxy Metrics</label>
                <div className="space-y-2">
                  {themeMetrics.map((metric, idx) => {
                    const isChecked = selectedMetrics.has(metric.id);
                    const letter = String.fromCharCode(65 + idx); // A, B, C...
                    return (
                      <label
                        key={metric.id}
                        className="flex items-center gap-3 p-2.5 rounded-[6px] border border-border bg-background hover:border-zinc-700 cursor-pointer transition-colors group shadow-sm"
                        onClick={() => toggleMetric(metric.id)}
                      >
                        {isChecked ? (
                          <div className="relative flex items-center justify-center w-4 h-4 rounded border border-indigo-500 bg-indigo-500 text-white shrink-0">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="2,6 5,9 10,3" />
                            </svg>
                          </div>
                        ) : (
                          <div className="relative flex items-center justify-center w-4 h-4 rounded border border-zinc-600 bg-transparent group-hover:border-zinc-500 shrink-0 transition-colors"></div>
                        )}
                        <span className="w-5 h-5 shrink-0 rounded bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center text-[12px] font-mono text-zinc-500">
                          {letter}
                        </span>
                        <span className={`text-[14px] ${isChecked ? "text-zinc-300 group-hover:text-zinc-200" : "text-zinc-400 group-hover:text-zinc-300"} transition-colors truncate`}>
                          {metric.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[12px] text-zinc-500 mt-2">Select which proxy metrics this issue impacts</p>
              </div>
            )}

            {/* Labels */}
            <div>
              <label className="block text-[12px] font-medium text-zinc-400 mb-2">Labels</label>
              <input
                type="text"
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                className="w-full bg-background border border-border rounded-[6px] px-3 py-2 text-[14px] text-zinc-200 placeholder:text-zinc-600 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-[color,box-shadow] shadow-sm"
                placeholder="e.g. infra, database, scaling"
              />
              <p className="text-[12px] text-zinc-500 mt-2">Optional tags for categorization</p>
            </div>

            {/* Model Tier */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-3">Model Tier</label>
              <div className="relative" style={{ maxWidth: "280px" }}>
                <select
                  value={complexity}
                  onChange={(e) => setComplexity(e.target.value)}
                  className="w-full appearance-none bg-[#09090b] border border-zinc-800 rounded-md px-3 py-2 pr-10 text-sm text-zinc-200 shadow-sm hover:border-zinc-700 transition-colors focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 outline-none"
                >
                  <option value="claude-code">Claude Code</option>
                  <option value="strategic">Strategic</option>
                  <option value="analyst">Analyst</option>
                  <option value="operator">Operator</option>
                  <option value="runner">Runner</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
                  <ChevronDown size={16} />
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-2">Sets which model tier this issue runs on.</p>

              {/* Budget */}
              <div className="mt-4">
                <label className="text-[11px] text-zinc-500 mb-1.5 block">Budget ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 10.00"
                  className="bg-[#09090b] border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 shadow-sm hover:border-zinc-700 transition-colors focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 outline-none"
                  style={{ maxWidth: "160px" }}
                />
                <p className="text-xs text-zinc-500 mt-1.5">Max spend for this issue. Agent pauses if exceeded.</p>
              </div>

              {escalationCount > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[11px] uppercase font-mono tracking-[0.15em] text-zinc-500">Escalation Count</span>
                  <span className="text-sm font-mono text-amber-400">{escalationCount}</span>
                </div>
              )}
            </div>

            {/* Danger Zone */}
            <div className="pt-6 mt-6 border-t border-red-500/10">
              <h3 className="text-[12px] font-medium text-red-400 mb-3">Danger Zone</h3>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-[6px] border border-red-500/20 bg-red-500/10 text-[14px] font-medium text-red-400 hover:bg-red-500/20 transition-[color,box-shadow] flex items-center gap-2 outline-none focus-visible:ring-[3px] focus-visible:ring-red-500/30"
              >
                <Trash2 size={16} />
                {deleting ? "Deleting..." : "Delete Issue"}
              </button>
            </div>
          </div>

          {/* Card Footer */}
          <div className="p-[20px] border-t border-border bg-card flex justify-between items-center">
            <span className="text-[12px] text-zinc-500">
              {originalRef.current?.updated
                ? `Last updated ${formatTimeAgo(originalRef.current.updated)}`
                : ""}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("issue-detail", { projectSlug, issueId })}
                className="px-4 py-2 rounded-[6px] border border-border bg-card text-[14px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-[color,box-shadow] shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={`px-4 py-2 rounded-[6px] border border-emerald-500/50 bg-emerald-500/10 text-[14px] font-medium text-emerald-300 shadow-sm flex items-center gap-2 outline-none ${
                  hasChanges && !saving
                    ? "hover:bg-emerald-500/20 hover:border-emerald-400 transition-colors"
                    : "opacity-50 cursor-not-allowed"
                }`}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
