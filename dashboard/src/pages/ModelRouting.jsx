/**
 * ModelRouting — manage model tier definitions, agent assignments,
 * and research phase mapping.
 * Route: #/model-routing
 */
import { useState, useEffect, useRef } from "react";
import { Cpu, Save, RotateCcw } from "lucide-react";
import { getModelRouting, updateModelRouting } from "../api.js";
import { AGENTS } from "../components/AssigneeSelect.jsx";
import { Skeleton } from "../components/ui/Skeleton.jsx";
import { EmptyState } from "../components/EmptyState.jsx";

// Available models for the tier dropdowns
const AVAILABLE_MODELS = [
  { value: "anthropic/claude-opus-4-6", label: "Opus 4.6" },
  { value: "anthropic/claude-sonnet-4-6", label: "Sonnet 4.6" },
  { value: "anthropic/claude-haiku-4-5", label: "Haiku 4.5" },
];

const THINKING_LEVELS = [
  { value: "off", label: "Off" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra High" },
  { value: "adaptive", label: "Adaptive" },
];

const RESEARCH_PHASES = [
  { key: "hypothesis", label: "Hypothesis Design" },
  { key: "execution", label: "Experiment Execution" },
  { key: "analysis", label: "Analysis / Interpretation" },
  { key: "synthesis", label: "Strategic Synthesis" },
];

// Default config — used when creating from scratch
const DEFAULT_CONFIG = {
  tiers: {
    coordinator: { model: "anthropic/claude-opus-4-6", thinking: "adaptive" },
    lead: { model: "anthropic/claude-sonnet-4-6", thinking: "high" },
    complex: { model: "anthropic/claude-sonnet-4-6", thinking: "medium" },
    simple: { model: "anthropic/claude-haiku-4-5", thinking: "off" },
  },
  agents: {},
  research_phases: {
    hypothesis: "coordinator",
    execution: "complex",
    analysis: "lead",
    synthesis: "coordinator",
  },
};

const TIER_ORDER = ["coordinator", "lead", "complex", "simple"];

// Friendly label for a model string
function modelLabel(modelStr) {
  const m = AVAILABLE_MODELS.find((m) => m.value === modelStr);
  return m ? m.label : modelStr;
}

// Resolve tier to display string: "Sonnet 4.6 (high)"
function resolveTierDisplay(tiers, tierName) {
  const tier = tiers[tierName];
  if (!tier) return "—";
  const label = modelLabel(tier.model);
  return tier.thinking && tier.thinking !== "off" ? `${label} (${tier.thinking})` : label;
}

/* ── Dropdown component matching Aura style ──────────────────────── */
function AuraSelect({ value, onChange, options, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-[#09090b] border border-zinc-800 rounded-md px-3 py-2 pr-10 text-sm text-zinc-200 shadow-sm hover:border-zinc-700 transition-colors focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

export default function ModelRouting({ navigate }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Snapshot of loaded config for change detection
  const originalRef = useRef(null);

  useEffect(() => {
    getModelRouting()
      .catch(() => ({ exists: false, config: null }))
      .then((routingData) => {
        const cfg = routingData.exists && routingData.config
          ? routingData.config
          : { ...DEFAULT_CONFIG, agents: buildDefaultAgentMap(AGENTS) };
        setConfig(cfg);
        originalRef.current = JSON.stringify(cfg);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Track changes
  useEffect(() => {
    if (!config || !originalRef.current) return;
    setHasChanges(JSON.stringify(config) !== originalRef.current);
  }, [config]);

  // Build default agent→tier map from agent list
  function buildDefaultAgentMap(agentList) {
    const map = {};
    for (const a of agentList) {
      const id = a.id || a.name?.toLowerCase();
      if (!id) continue;
      // Sam is coordinator, known leads get lead, rest get complex
      if (id === "sam" || id === "main") map[id] = "coordinator";
      else if (["binny", "leslie", "ritam", "ej", "kiko"].includes(id)) map[id] = "lead";
      else map[id] = "complex";
    }
    return map;
  }

  function updateTier(tierName, field, value) {
    setConfig((prev) => ({
      ...prev,
      tiers: {
        ...prev.tiers,
        [tierName]: { ...prev.tiers[tierName], [field]: value },
      },
    }));
  }

  function updateAgentTier(agentId, tierName) {
    setConfig((prev) => ({
      ...prev,
      agents: { ...prev.agents, [agentId]: tierName },
    }));
  }

  function updateResearchPhase(phase, tierName) {
    setConfig((prev) => ({
      ...prev,
      research_phases: { ...prev.research_phases, [phase]: tierName },
    }));
  }

  async function handleSave() {
    if (!hasChanges || saving) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      await updateModelRouting(config);
      originalRef.current = JSON.stringify(config);
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (!originalRef.current) return;
    setConfig(JSON.parse(originalRef.current));
    setHasChanges(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (!config) {
    return (
      <EmptyState
        icon={Cpu}
        text="No routing config"
        sub="Configure model routing to control which models your agents use."
      />
    );
  }

  const tierOptions = TIER_ORDER.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }));

  return (
    <div className="space-y-6">
      {/* Breadcrumb bar + save */}
      <div className="h-12 flex items-center justify-between">
        <h1 className="text-base font-semibold uppercase tracking-wider">Model Routing</h1>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="text-sm text-emerald-400">Saved</span>
          )}
          {error && (
            <span className="text-sm text-red-400 truncate max-w-[300px]">{error}</span>
          )}
          {hasChanges && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-[6px] border border-zinc-800 bg-card text-sm font-medium text-zinc-400 hover:bg-accent transition-colors flex items-center gap-1.5"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`px-4 py-1.5 rounded-[6px] border border-emerald-500/50 bg-emerald-500/10 text-sm font-medium text-emerald-300 flex items-center gap-1.5 shadow-sm ${
              hasChanges && !saving
                ? "hover:bg-emerald-500/20 hover:border-emerald-400 transition-colors"
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            <Save size={14} />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* ── Section 1: Tier Definitions ──────────────────────────── */}
      <div className="bg-card border border-border rounded-[2px] shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 bg-cyan-500/[0.02]">
          <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-[15px] font-medium text-cyan-100">Tier Definitions</div>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-500 mb-4">
            Define what model and thinking level each tier uses. Changing a tier updates all agents and research phases assigned to it.
          </p>
          <div className="space-y-3">
            {TIER_ORDER.map((tierName) => {
              const tier = config.tiers[tierName] || {};
              return (
                <div key={tierName} className="flex items-center gap-4 p-3 rounded-md border border-zinc-800 bg-[#09090b]">
                  <span className="w-28 text-sm font-medium text-zinc-300 capitalize shrink-0">{tierName}</span>
                  <AuraSelect
                    value={tier.model || ""}
                    onChange={(v) => updateTier(tierName, "model", v)}
                    options={AVAILABLE_MODELS}
                    className="flex-1"
                  />
                  <AuraSelect
                    value={tier.thinking || "off"}
                    onChange={(v) => updateTier(tierName, "thinking", v)}
                    options={THINKING_LEVELS}
                    className="w-40"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Section 2: Agent Assignments ─────────────────────────── */}
      <div className="bg-card border border-border rounded-[2px] shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 bg-indigo-500/[0.02]">
          <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="text-[15px] font-medium text-indigo-100">Agent Assignments</div>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-500 mb-4">
            Assign each agent to a tier. This sets their default model when they run tasks.
          </p>
          <div className="space-y-2">
            {AGENTS.map((agent) => {
              const id = agent.id;
              const currentTier = config.agents[id] || "complex";
              return (
                <div key={id} className="flex items-center gap-4 p-3 rounded-md border border-zinc-800 bg-[#09090b]">
                  <div className="flex items-center gap-2 w-40 shrink-0">
                    {agent.emoji && <span className="text-base">{agent.emoji}</span>}
                    <span className="text-sm font-medium text-zinc-300">{agent.name || id}</span>
                  </div>
                  <AuraSelect
                    value={currentTier}
                    onChange={(v) => updateAgentTier(id, v)}
                    options={tierOptions}
                    className="w-40"
                  />
                  <span className="text-xs text-zinc-500 font-mono">
                    {resolveTierDisplay(config.tiers, currentTier)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Section 3: Research Phase Mapping ────────────────────── */}
      <div className="bg-card border border-border rounded-[2px] shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 bg-violet-500/[0.02]">
          <div className="w-6 h-6 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div className="text-[15px] font-medium text-violet-100">Research Phase Mapping</div>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-500 mb-4">
            Map each research loop phase to a tier. Agents use these when running experiments.
          </p>
          <div className="space-y-2">
            {RESEARCH_PHASES.map(({ key, label }) => {
              const currentTier = config.research_phases[key] || "complex";
              return (
                <div key={key} className="flex items-center gap-4 p-3 rounded-md border border-zinc-800 bg-[#09090b]">
                  <span className="w-52 text-sm font-medium text-zinc-300 shrink-0">{label}</span>
                  <AuraSelect
                    value={currentTier}
                    onChange={(v) => updateResearchPhase(key, v)}
                    options={tierOptions}
                    className="w-40"
                  />
                  <span className="text-xs text-zinc-500 font-mono">
                    {resolveTierDisplay(config.tiers, currentTier)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
