import { useState, useMemo } from "react";
import { X, Plus, Trash2, ChevronDown, ChevronRight, Target, FileText, AlertTriangle } from "lucide-react";
import { previewStrategyChanges, applyStrategyChanges } from "../api.js";

const THEME_COLORS = [
  { badgeBg: "bg-indigo-500/10", badgeBorder: "border-indigo-500/20", text: "text-indigo-400", tint: "bg-indigo-500/[0.02]", title: "text-indigo-100" },
  { badgeBg: "bg-emerald-500/10", badgeBorder: "border-emerald-500/20", text: "text-emerald-400", tint: "bg-emerald-500/[0.02]", title: "text-emerald-100" },
  { badgeBg: "bg-amber-500/10", badgeBorder: "border-amber-500/20", text: "text-amber-400", tint: "bg-amber-500/[0.02]", title: "text-amber-100" },
  { badgeBg: "bg-cyan-500/10", badgeBorder: "border-cyan-500/20", text: "text-cyan-400", tint: "bg-cyan-500/[0.02]", title: "text-cyan-100" },
  { badgeBg: "bg-rose-500/10", badgeBorder: "border-rose-500/20", text: "text-rose-400", tint: "bg-rose-500/[0.02]", title: "text-rose-100" },
];

// Generate a slug from a title
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function EditStrategyModal({ project, themes: initialThemes, projectSlug, onClose, onSaved }) {
  const [step, setStep] = useState("edit"); // "edit" | "review"
  const [themes, setThemes] = useState(() =>
    // Deep clone and only show approved/retired themes (not proposed)
    initialThemes
      .filter((t) => t.status === "approved" || t.status === "retired")
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      .map((t) => ({
        ...t,
        proxy_metrics: (t.proxy_metrics || []).map((m) => ({ ...m })),
        _original_id: t.id,
      }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [issueDecisions, setIssueDecisions] = useState({}); // id → boolean (true = keep)
  const [experimentDecisions, setExperimentDecisions] = useState({}); // dir → boolean
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Track whether anything changed
  const hasChanges = useMemo(() => {
    if (themes.length !== initialThemes.filter((t) => t.status === "approved" || t.status === "retired").length) return true;
    for (const theme of themes) {
      const orig = initialThemes.find((t) => t.id === theme._original_id);
      if (!orig) return true; // new theme
      if (theme.id !== orig.id) return true;
      if (theme.title !== orig.title) return true;
      if (theme.description !== (orig.description || "")) return true;
      if (theme.status !== orig.status) return true;
      if (theme.max_active_issues !== (orig.max_active_issues ?? 5)) return true;
      if (theme.max_active_experiments !== (orig.max_active_experiments ?? 2)) return true;
      const origMetrics = orig.proxy_metrics || [];
      const curMetrics = theme.proxy_metrics || [];
      if (curMetrics.length !== origMetrics.length) return true;
      for (let i = 0; i < curMetrics.length; i++) {
        if (curMetrics[i].id !== origMetrics[i]?.id) return true;
        if (curMetrics[i].name !== origMetrics[i]?.name) return true;
        if (curMetrics[i].description !== (origMetrics[i]?.description || "")) return true;
        if (curMetrics[i].target !== (origMetrics[i]?.target || "")) return true;
      }
    }
    return false;
  }, [themes, initialThemes]);

  // Validation
  const validationErrors = useMemo(() => {
    const errors = [];
    const ids = themes.map((t) => t.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length > 0) errors.push(`Duplicate theme IDs: ${[...new Set(dupes)].join(", ")}`);
    for (const theme of themes) {
      if (!theme.id.trim()) errors.push(`Theme "${theme.title || "(untitled)"}" needs an ID`);
      if (!theme.title.trim()) errors.push(`Theme with ID "${theme.id}" needs a title`);
      if (theme.status !== "retired" && (!theme.proxy_metrics || theme.proxy_metrics.length === 0)) {
        errors.push(`"${theme.title || theme.id}" needs at least 1 proxy metric`);
      }
      for (const m of theme.proxy_metrics || []) {
        if (!m.id.trim() || !m.name.trim()) errors.push(`Metric in "${theme.title || theme.id}" needs an ID and name`);
      }
    }
    return errors;
  }, [themes]);

  const updateTheme = (idx, field, value) => {
    setThemes((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      // Auto-update ID when title changes (only for new themes without _original_id match)
      if (field === "title" && !initialThemes.find((t) => t.id === next[idx]._original_id)) {
        next[idx].id = slugify(value);
      }
      return next;
    });
  };

  const updateMetric = (themeIdx, metricIdx, field, value) => {
    setThemes((prev) => {
      const next = [...prev];
      const metrics = [...next[themeIdx].proxy_metrics];
      metrics[metricIdx] = { ...metrics[metricIdx], [field]: value };
      // Auto-update metric ID when name changes for new metrics
      if (field === "name") {
        const orig = initialThemes.find((t) => t.id === next[themeIdx]._original_id);
        const origMetric = orig?.proxy_metrics?.find((m) => m.id === metrics[metricIdx].id);
        if (!origMetric) {
          metrics[metricIdx].id = slugify(value);
        }
      }
      next[themeIdx] = { ...next[themeIdx], proxy_metrics: metrics };
      return next;
    });
  };

  const addMetric = (themeIdx) => {
    setThemes((prev) => {
      const next = [...prev];
      const metrics = [...next[themeIdx].proxy_metrics];
      if (metrics.length >= 3) return prev;
      metrics.push({ id: "", name: "", description: "", target: "", order: metrics.length + 1 });
      next[themeIdx] = { ...next[themeIdx], proxy_metrics: metrics };
      return next;
    });
  };

  const removeMetric = (themeIdx, metricIdx) => {
    setThemes((prev) => {
      const next = [...prev];
      const metrics = [...next[themeIdx].proxy_metrics];
      if (next[themeIdx].status !== "retired" && metrics.length <= 1) return prev;
      metrics.splice(metricIdx, 1);
      next[themeIdx] = { ...next[themeIdx], proxy_metrics: metrics };
      return next;
    });
  };

  const addTheme = () => {
    setThemes((prev) => [
      ...prev,
      {
        id: "",
        title: "",
        description: "",
        status: "approved",
        max_active_issues: 5,
        max_active_experiments: 2,
        order: prev.length + 1,
        proxy_metrics: [{ id: "", name: "", description: "", target: "", order: 1 }],
        _original_id: null,
      },
    ]);
  };

  const retireTheme = (idx) => {
    setThemes((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], status: next[idx].status === "retired" ? "approved" : "retired" };
      return next;
    });
  };

  const handleReviewChanges = async () => {
    setError(null);
    setLoading(true);
    try {
      // Build request body with previous_id for renames
      const requestThemes = themes.map((t) => {
        const base = {
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          max_active_issues: t.max_active_issues,
          max_active_experiments: t.max_active_experiments,
          order: t.order,
          proxy_metrics: t.proxy_metrics,
        };
        // Include previous_id when theme was renamed
        if (t._original_id && t._original_id !== t.id && initialThemes.find((orig) => orig.id === t._original_id)) {
          base.previous_id = t._original_id;
        }
        return base;
      });

      const result = await previewStrategyChanges(projectSlug, requestThemes);
      setPreview(result);

      // Default all to "keep"
      const issueDecs = {};
      for (const issue of result.affected_issues || []) {
        issueDecs[issue.id] = true;
      }
      setIssueDecisions(issueDecs);

      const expDecs = {};
      for (const exp of result.affected_experiments || []) {
        expDecs[exp.dir] = true;
      }
      setExperimentDecisions(expDecs);

      setStep("review");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setError(null);
    setSaving(true);
    try {
      const requestThemes = themes.map((t) => {
        const base = {
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          max_active_issues: t.max_active_issues,
          max_active_experiments: t.max_active_experiments,
          order: t.order,
          proxy_metrics: t.proxy_metrics,
        };
        if (t._original_id && t._original_id !== t.id && initialThemes.find((orig) => orig.id === t._original_id)) {
          base.previous_id = t._original_id;
        }
        return base;
      });

      const keepIssueIds = Object.entries(issueDecisions).filter(([, v]) => v).map(([k]) => k);
      const discardIssueIds = Object.entries(issueDecisions).filter(([, v]) => !v).map(([k]) => k);
      const keepExpIds = Object.entries(experimentDecisions).filter(([, v]) => v).map(([k]) => k);
      const discardExpIds = Object.entries(experimentDecisions).filter(([, v]) => !v).map(([k]) => k);

      const result = await applyStrategyChanges(projectSlug, {
        themes: requestThemes,
        issue_decisions: { keep: keepIssueIds, discard: discardIssueIds },
        experiment_decisions: { keep: keepExpIds, discard: discardExpIds },
      });

      // Show toast and close
      const agentName = (result.lead && result.lead !== "unknown") ? result.lead : "Agent";
      onSaved?.(`Strategy updated. ${agentName} will review on next heartbeat.`);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Group affected items by change type for the review step
  const groupedChanges = useMemo(() => {
    if (!preview) return [];
    const groups = [];

    const { changes, affected_issues, affected_experiments } = preview;

    // Renamed themes
    for (const r of changes.renamed || []) {
      const issues = affected_issues.filter((i) => i.change_type === "renamed" && i.from_theme === r.from);
      const exps = affected_experiments.filter((e) => e.change_type === "renamed" && e.from_theme === r.from);
      if (issues.length > 0 || exps.length > 0) {
        groups.push({ type: "renamed", label: `Theme renamed: "${r.from}" → "${r.to}"`, issues, experiments: exps });
      }
    }

    // Retired themes
    for (const themeId of changes.retired || []) {
      const issues = affected_issues.filter((i) => i.change_type === "retired" && i.theme === themeId);
      const exps = affected_experiments.filter((e) => e.change_type === "retired" && e.theme === themeId);
      if (issues.length > 0 || exps.length > 0) {
        groups.push({ type: "retired", label: `Theme retired: "${themeId}"`, issues, experiments: exps });
      }
    }

    // Metric removals
    for (const mr of changes.metrics_removed || []) {
      const issues = affected_issues.filter((i) => i.change_type === "metric_removed" && (i.removed_metrics || []).includes(mr.metric));
      if (issues.length > 0) {
        groups.push({ type: "metric_removed", label: `Metric removed: "${mr.metric}" from ${mr.theme}`, issues, experiments: [] });
      }
    }

    return groups;
  }, [preview]);

  const noImpact = preview && (preview.affected_issues || []).length === 0 && (preview.affected_experiments || []).length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-background border border-border w-full max-w-4xl mx-4 my-8 rounded-[2px] shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <h2 className="text-[16px] font-semibold text-foreground">
              {step === "edit" ? "Edit Strategy" : "Impact Review"}
            </h2>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <X size={16} />
          </button>
        </div>

        {step === "edit" ? (
          <>
            {/* Mission & NSM — read only */}
            <div className="px-6 pt-5 pb-3 space-y-3">
              <div className="flex items-center gap-2 text-[12px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                <Target size={12} />
                Mission
              </div>
              <p className="text-[14px] text-zinc-400">{project.mission || "No mission defined."}</p>

              <div className="flex items-center gap-2 text-[12px] font-mono uppercase tracking-[0.15em] text-muted-foreground mt-4">
                <Target size={12} />
                North Star Metric
              </div>
              <p className="text-[15px] text-zinc-200 font-medium">{project.nsm || "Not set"}</p>
            </div>

            <div className="border-t border-border/50 mx-6" />

            {/* Themes editor */}
            <div className="px-6 py-4 space-y-4">
              <div className="text-[12px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Themes</div>

              {themes.length === 0 && (
                <div className="text-[14px] text-muted-foreground py-8 text-center">
                  No themes yet. Add one to get started.
                </div>
              )}

              {themes.map((theme, idx) => {
                const colors = THEME_COLORS[idx % THEME_COLORS.length];
                const isRetired = theme.status === "retired";

                return (
                  <div
                    key={theme._original_id || `new-${idx}`}
                    className={`border border-border rounded-[2px] ${isRetired ? "opacity-50" : ""}`}
                  >
                    {/* Theme header */}
                    <div className={`flex items-center gap-3 px-4 py-3 ${colors.tint}`}>
                      <div className={`w-6 h-6 rounded-full ${colors.badgeBg} border ${colors.badgeBorder} flex items-center justify-center text-[12px] font-mono font-medium ${colors.text} flex-shrink-0`}>
                        {idx + 1}
                      </div>
                      <input
                        type="text"
                        value={theme.title}
                        onChange={(e) => updateTheme(idx, "title", e.target.value)}
                        placeholder="Theme title"
                        disabled={isRetired}
                        className={`flex-1 bg-transparent border-none outline-none text-[15px] font-medium ${colors.title} placeholder:text-zinc-600`}
                      />
                      {isRetired && (
                        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium border border-zinc-700/50 bg-zinc-800/50 text-muted-foreground">
                          Retired
                        </span>
                      )}
                      <button
                        onClick={() => retireTheme(idx)}
                        className="text-[12px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-[6px] hover:bg-accent"
                      >
                        {isRetired ? "Restore" : "Retire"}
                      </button>
                    </div>

                    {/* Theme body — collapsed when retired */}
                    {!isRetired && (
                      <div className="px-4 py-3 space-y-3">
                        {/* Description */}
                        <textarea
                          value={theme.description || ""}
                          onChange={(e) => updateTheme(idx, "description", e.target.value)}
                          placeholder="Theme description"
                          rows={2}
                          className="w-full bg-background border border-border rounded-[6px] px-3 py-2 text-[14px] text-zinc-300 placeholder:text-zinc-600 focus:ring-[3px] focus:ring-ring/50 outline-none resize-none"
                        />

                        {/* Caps */}
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2">
                            <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Max issues</span>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={theme.max_active_issues ?? 5}
                              onChange={(e) => updateTheme(idx, "max_active_issues", parseInt(e.target.value) || 5)}
                              className="w-14 bg-background border border-border rounded-[6px] px-2 py-1 text-[14px] text-zinc-300 font-mono text-center focus:ring-[3px] focus:ring-ring/50 outline-none"
                            />
                          </label>
                          <label className="flex items-center gap-2">
                            <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Max experiments</span>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={theme.max_active_experiments ?? 2}
                              onChange={(e) => updateTheme(idx, "max_active_experiments", parseInt(e.target.value) || 2)}
                              className="w-14 bg-background border border-border rounded-[6px] px-2 py-1 text-[14px] text-zinc-300 font-mono text-center focus:ring-[3px] focus:ring-ring/50 outline-none"
                            />
                          </label>
                        </div>

                        {/* Proxy metrics */}
                        <div className="space-y-2">
                          <div className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Proxy Metrics</div>
                          {(theme.proxy_metrics || []).map((metric, mIdx) => (
                            <div key={mIdx} className="flex items-start gap-2">
                              <div className="w-4 h-4 rounded bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center text-[11px] font-mono text-zinc-500 flex-shrink-0 mt-2">
                                {String.fromCharCode(97 + mIdx)}
                              </div>
                              <div className="flex-1 grid grid-cols-[1fr_1fr_auto] gap-2">
                                <input
                                  type="text"
                                  value={metric.name}
                                  onChange={(e) => updateMetric(idx, mIdx, "name", e.target.value)}
                                  placeholder="Metric name"
                                  className="bg-background border border-border rounded-[6px] px-2.5 py-1.5 text-[13px] text-zinc-300 placeholder:text-zinc-600 focus:ring-[3px] focus:ring-ring/50 outline-none"
                                />
                                <input
                                  type="text"
                                  value={metric.target || ""}
                                  onChange={(e) => updateMetric(idx, mIdx, "target", e.target.value)}
                                  placeholder="Target (e.g. 10/week)"
                                  className="bg-background border border-border rounded-[6px] px-2.5 py-1.5 text-[13px] text-zinc-300 placeholder:text-zinc-600 focus:ring-[3px] focus:ring-ring/50 outline-none"
                                />
                                <button
                                  onClick={() => removeMetric(idx, mIdx)}
                                  disabled={theme.proxy_metrics.length <= 1}
                                  className="h-[30px] w-[30px] flex items-center justify-center rounded-[6px] text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                          {(theme.proxy_metrics || []).length < 3 && (
                            <button
                              onClick={() => addMetric(idx)}
                              className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors ml-6"
                            >
                              <Plus size={12} />
                              Add Metric
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add theme */}
              <button
                onClick={addTheme}
                className="w-full py-3 border border-dashed border-border rounded-[2px] text-[14px] text-muted-foreground hover:text-foreground hover:border-zinc-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={14} />
                Add Theme
              </button>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <div>
                {error && (
                  <div className="flex items-center gap-2 text-[13px] text-red-400">
                    <AlertTriangle size={13} />
                    {error}
                  </div>
                )}
                {validationErrors.length > 0 && !error && (
                  <div className="text-[12px] text-amber-400">{validationErrors[0]}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-[6px] border border-border bg-card text-[15px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReviewChanges}
                  disabled={!hasChanges || validationErrors.length > 0 || loading}
                  className="px-4 py-2 rounded-[6px] border border-indigo-500/50 bg-indigo-500/10 text-[15px] font-medium text-indigo-300 hover:bg-indigo-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? "Analyzing..." : "Review Changes"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Review step */}
            <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {noImpact ? (
                <div className="text-center py-8">
                  <div className="text-[14px] text-zinc-400">No existing issues or experiments are affected by these changes.</div>
                  <div className="text-[12px] text-muted-foreground mt-1">New themes and metrics will be available immediately.</div>
                </div>
              ) : (
                groupedChanges.map((group, gIdx) => (
                  <div key={gIdx} className="border border-border rounded-[2px]">
                    <div className={`px-4 py-2.5 border-b border-border/50 ${
                      group.type === "renamed" ? "bg-amber-500/[0.03]" :
                      group.type === "retired" ? "bg-red-500/[0.03]" :
                      "bg-zinc-800/30"
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border ${
                          group.type === "renamed" ? "border-amber-500/20 bg-amber-500/10 text-amber-400" :
                          group.type === "retired" ? "border-red-500/20 bg-red-500/10 text-red-400" :
                          "border-zinc-700/50 bg-zinc-800/50 text-muted-foreground"
                        }`}>
                          {group.type === "metric_removed" ? "metric removed" : group.type}
                        </span>
                        <span className="text-[13px] text-zinc-300">{group.label}</span>
                      </div>
                    </div>

                    <div className="divide-y divide-border/30">
                      {/* Issues */}
                      {group.issues.map((issue) => (
                        <label key={issue.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={issueDecisions[issue.id] ?? true}
                            onChange={(e) => setIssueDecisions((prev) => ({ ...prev, [issue.id]: e.target.checked }))}
                            className="rounded-[4px] border-border bg-background"
                          />
                          <span className="text-[11px] font-mono text-muted-foreground">{issue.id}</span>
                          <span className="text-[13px] text-zinc-300 flex-1">{issue.title}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                            issue.status === "in_progress" ? "border-indigo-500/20 bg-indigo-500/10 text-indigo-400" :
                            issue.status === "todo" ? "border-zinc-700/50 bg-zinc-800/50 text-muted-foreground" :
                            issue.status === "proposed" ? "border-violet-500/20 bg-violet-500/10 text-violet-400" :
                            "border-zinc-700/50 bg-zinc-800/50 text-muted-foreground"
                          }`}>
                            {(issue.status || "").replace("_", " ")}
                          </span>
                          <span className="text-[11px] text-muted-foreground w-16 text-right">
                            {(issueDecisions[issue.id] ?? true) ? "keep" : "discard"}
                          </span>
                        </label>
                      ))}

                      {/* Experiments */}
                      {group.experiments.map((exp) => (
                        <label key={exp.dir} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={experimentDecisions[exp.dir] ?? true}
                            onChange={(e) => setExperimentDecisions((prev) => ({ ...prev, [exp.dir]: e.target.checked }))}
                            className="rounded-[4px] border-border bg-background"
                          />
                          <span className="text-[11px] font-mono text-muted-foreground">{exp.dir}</span>
                          <span className="text-[13px] text-zinc-300 flex-1">{exp.name}</span>
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
                            experiment
                          </span>
                          <span className="text-[11px] text-muted-foreground w-16 text-right">
                            {(experimentDecisions[exp.dir] ?? true) ? "keep" : "discard"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <div>
                {error && (
                  <div className="flex items-center gap-2 text-[13px] text-red-400">
                    <AlertTriangle size={13} />
                    {error}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setStep("edit"); setError(null); }}
                  className="px-4 py-2 rounded-[6px] border border-border bg-card text-[15px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  Back to Edit
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="px-4 py-2 rounded-[6px] border border-emerald-500/50 bg-emerald-500/10 text-[15px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "Confirm & Notify Agent"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
