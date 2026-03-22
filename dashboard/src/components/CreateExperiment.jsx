/**
 * CreateExperiment — inline form for creating a new experiment.
 * UI ported from Aura HTML reference.
 */
import { useState } from"react";
import { X, FlaskConical } from"lucide-react";
import { createExperiment } from"../api.js";

export function CreateExperiment({ projectSlug, themes = [], onCreated, onClose }) {
 const [name, setName] = useState("");
 const [hypothesis, setHypothesis] = useState("");
 const [primaryMetric, setPrimaryMetric] = useState("");
 const [targetValue, setTargetValue] = useState("");
 const [programMd, setProgramMd] = useState("");
 const [selectedTheme, setSelectedTheme] = useState("");
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState(null);

 async function handleSubmit(e) {
  e.preventDefault();
  if (!name.trim() || !hypothesis.trim()) return;
  setSubmitting(true);
  setError(null);
  try {
   const result = await createExperiment({
    project: projectSlug,
    name: name.trim(),
    hypothesis: hypothesis.trim(),
    proxy_metric: primaryMetric || null,
    target_value: targetValue.trim() || null,
    program_md: programMd.trim() || null,
    theme: selectedTheme || null,
   });
   onCreated?.(result);
  } catch (err) {
   setError(err.message);
  } finally {
   setSubmitting(false);
  }
 }

 return (
  <div className="bg-card border border-border rounded-[2px] flex flex-col relative overflow-hidden">
   {/* Card Header — Aura */}
   <div className="flex items-center gap-3 px-5 py-3 bg-cyan-500/[0.02] transition-colors">
    <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
     <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
    </div>
    <div className="text-[15px] font-medium text-cyan-100 flex-1">New Experiment</div>
    <div className="flex items-center gap-2">
     <span className="flex items-center gap-1.5 px-2 py-1 rounded-[6px] bg-zinc-800 border border-border text-[12px] text-zinc-400 font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
      Draft
     </span>
     {onClose && (
      <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100 transition-colors">
       <X size={18} />
      </button>
     )}
    </div>
   </div>

   {/* Form Body — Aura */}
   <form onSubmit={handleSubmit}>
    <div className="p-[20px] space-y-6">

     {/* 1. Experiment Name */}
     <div>
      <label className="block text-[12px] font-medium text-zinc-400 mb-2">Experiment Name</label>
      <input
       type="text"
       value={name}
       onChange={(e) => setName(e.target.value)}
       placeholder="e.g. Batch Size Optimization"
       autoFocus
       className="w-full bg-transparent border border-border rounded-[6px] px-3 py-2 text-[14px] text-zinc-200 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-all"
      />
     </div>

     {/* 2. Hypothesis */}
     <div>
      <label className="block text-[12px] font-medium text-zinc-400 mb-2">Hypothesis</label>
      <textarea
       value={hypothesis}
       onChange={(e) => setHypothesis(e.target.value)}
       rows={4}
       placeholder="What do you expect to happen? e.g. Increasing batch size from 500 to 2000 will reduce CPU usage by 15%"
       className="w-full bg-transparent border border-border rounded-[6px] px-3 py-2 text-[14px] text-zinc-200 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-all resize-none"
      />
     </div>

     {/* 3. Theme — moved above metrics */}
     {themes.length > 0 && (
      <div>
       <label className="block text-[12px] font-medium text-zinc-400 mb-2">Theme</label>
       <div className="relative group w-full md:w-1/2">
        <select
         value={selectedTheme}
         onChange={(e) => setSelectedTheme(e.target.value)}
         className="w-full bg-transparent border border-border rounded-[6px] px-3 py-2 text-[14px] text-zinc-200 pr-10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-all cursor-pointer appearance-none"
        >
         <option value="">No theme</option>
         {themes.map((t) => (
          <option key={t.id} value={t.id}>{t.title}</option>
         ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
         <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
       </div>
       <p className="text-[12px] text-zinc-500 mt-2">Link this experiment to a strategic theme</p>
      </div>
     )}

     {/* 4. Two-column: Proxy Metric & Target Value — Aura */}
     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
       <label className="block text-[12px] font-medium text-zinc-400 mb-2">Proxy Metric</label>
       <div className="relative group w-full">
        <select
         value={primaryMetric}
         onChange={(e) => setPrimaryMetric(e.target.value)}
         className="w-full bg-transparent border border-border rounded-[6px] px-3 py-2 text-[14px] text-zinc-200 pr-10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-all cursor-pointer appearance-none"
        >
         <option value="">Select a metric...</option>
         <option value="CPU utilization %">CPU utilization %</option>
         <option value="Memory usage %">Memory usage %</option>
         <option value="Request latency (p95)">Request latency (p95)</option>
         <option value="Error rate %">Error rate %</option>
         <option value="Throughput (req/s)">Throughput (req/s)</option>
         <option value="Cost per query ($)">Cost per query ($)</option>
         <option value="Cache hit rate %">Cache hit rate %</option>
         <option value="Token usage">Token usage</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
         <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
       </div>
      </div>
      <div>
       <label className="block text-[12px] font-medium text-zinc-400 mb-2">Target Value</label>
       <div className="relative">
        <input
         type="text"
         value={targetValue}
         onChange={(e) => setTargetValue(e.target.value)}
         placeholder="e.g. -15"
         className="w-full bg-transparent border border-border rounded-[6px] pl-3 pr-8 py-2 text-[14px] text-zinc-200 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-all"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[14px] font-medium">%</span>
       </div>
      </div>
     </div>

     {/* 5. Experiment Program — Aura: textarea with helper */}
     <div>
      <label className="block text-[12px] font-medium text-zinc-400 mb-2">Experiment Program</label>
      <textarea
       value={programMd}
       onChange={(e) => setProgramMd(e.target.value)}
       rows={6}
       placeholder="Describe the experiment methodology, variables, and success criteria. Markdown supported."
       className="w-full bg-transparent border border-border rounded-[6px] px-3 py-2 text-[14px] text-zinc-200 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-all resize-y font-mono leading-relaxed"
      />
      <p className="text-[12px] text-zinc-500 mt-2">
       This becomes the experiment's program.md — the source of truth for what to test and how.
      </p>
     </div>

     {/* Metrics Preview — Aura: dashed border, conditional */}
     {primaryMetric && (
      <div className="mt-8 border border-dashed border-border rounded-[2px] p-4 bg-zinc-900/10 relative overflow-hidden">
       <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />
       <div className="flex items-center gap-2 mb-4 relative">
        <span className="text-[12px] font-medium text-zinc-400">Preview</span>
       </div>
       <div className="grid grid-cols-2 gap-4 relative">
        <div className="flex flex-col">
         <div className="text-[12px] font-medium text-zinc-400 mb-1">Proxy Metric</div>
         <div className="text-[14px] font-medium text-zinc-100">{primaryMetric}</div>
        </div>
        {targetValue && (
         <div className="flex flex-col">
          <div className="text-[12px] font-medium text-zinc-400 mb-1">Target Value</div>
          <div className="text-[14px] font-medium text-cyan-400">{targetValue}%</div>
         </div>
        )}
       </div>
      </div>
     )}
    </div>

    {/* Error */}
    {error && (
     <div className="mx-5 mb-4 border border-red-500/20 bg-red-500/5 rounded-[2px] px-4 py-3 text-[14px] text-red-400">
      {error}
     </div>
    )}

    {/* Card Footer — Aura: cyan tint for experiments */}
    <div className="p-[20px] border-t border-border bg-card flex justify-end gap-3">
     {onClose && (
      <button
       type="button"
       onClick={onClose}
       className="px-4 py-2 rounded-[6px] border border-border bg-card text-[14px] font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
       Cancel
      </button>
     )}
     <button
      type="submit"
      disabled={!name.trim() || !hypothesis.trim() || submitting}
      className="px-4 py-2 rounded-[6px] border border-cyan-500/50 bg-cyan-500/10 text-[14px] font-medium text-cyan-300 hover:bg-cyan-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
     >
      {submitting ?"Creating..." :"Create Experiment"}
     </button>
    </div>
   </form>
  </div>
 );
}
