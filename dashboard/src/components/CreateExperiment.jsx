/**
 * CreateExperiment — inline form for creating a new experiment.
 * Structured fields matching the program.md format:
 * Title, Hypothesis, Theme, Proxy Metrics, Playbook, Eval Method, Decision Triggers, Constraints.
 */
import { useState } from"react";
import { X, FlaskConical } from"lucide-react";
import { createExperiment } from"../api.js";

export function CreateExperiment({ projectSlug, themes = [], onCreated, onClose }) {
 const [name, setName] = useState("");
 const [hypothesis, setHypothesis] = useState("");
 const [primaryMetric, setPrimaryMetric] = useState("");
 const [targetValue, setTargetValue] = useState("");
 const [playbook, setPlaybook] = useState("");
 const [evalMethod, setEvalMethod] = useState("");
 const [decisionTriggers, setDecisionTriggers] = useState("");
 const [constraints, setConstraints] = useState("");
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
    theme: selectedTheme || null,
    playbook: playbook.trim() || null,
    eval_method: evalMethod.trim() || null,
    decision_triggers: decisionTriggers.trim() || null,
    constraints: constraints.trim() || null,
   });
   onCreated?.(result);
  } catch (err) {
   setError(err.message);
  } finally {
   setSubmitting(false);
  }
 }

 /* Shared textarea classes */
 const textareaCls = "w-full bg-transparent border border-border rounded-[6px] px-3 py-2 text-[14px] text-zinc-200 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-all resize-y font-mono leading-relaxed";
 const labelCls = "block text-[12px] font-medium text-zinc-400 mb-2";
 const hintCls = "text-[12px] text-zinc-500 mt-2";

 return (
  <div className="bg-card border border-border rounded-[2px] flex flex-col relative overflow-hidden">
   {/* Card Header */}
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

   {/* Form Body */}
   <form onSubmit={handleSubmit}>
    <div className="p-[20px] space-y-6">

     {/* 1. Experiment Name */}
     <div>
      <label className={labelCls}>Experiment Name</label>
      <input
       type="text"
       value={name}
       onChange={(e) => setName(e.target.value)}
       placeholder="e.g. Convert r/productivity founders via Chief of Staff angle"
       autoFocus
       className="w-full bg-transparent border border-border rounded-[6px] px-3 py-2 text-[14px] text-zinc-200 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-all"
      />
      <p className={hintCls}>Action-oriented: what the experiment is trying to achieve</p>
     </div>

     {/* 2. Hypothesis */}
     <div>
      <label className={labelCls}>Hypothesis</label>
      <textarea
       value={hypothesis}
       onChange={(e) => setHypothesis(e.target.value)}
       rows={3}
       placeholder="Posting value-first content on r/productivity with a Chief of Staff angle will drive 5+ signups per post within 48h"
       className={textareaCls}
      />
     </div>

     {/* 3. Theme */}
     {themes.length > 0 && (
      <div>
       <label className={labelCls}>Theme</label>
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
      </div>
     )}

     {/* 4. Proxy Metric & Target */}
     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
       <label className={labelCls}>Proxy Metric</label>
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
       <label className={labelCls}>Target Value</label>
       <div className="relative">
        <input
         type="text"
         value={targetValue}
         onChange={(e) => setTargetValue(e.target.value)}
         placeholder="e.g. 5 signups/post"
         className="w-full bg-transparent border border-border rounded-[6px] px-3 py-2 text-[14px] text-zinc-200 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-all"
        />
       </div>
      </div>
     </div>

     {/* 5. Playbook — the execution plan */}
     <div>
      <label className={labelCls}>Playbook</label>
      <textarea
       value={playbook}
       onChange={(e) => setPlaybook(e.target.value)}
       rows={5}
       placeholder={"- **Audience:** Founders and solopreneurs on r/productivity\n- **Angle:** Chief of Staff for solo operators\n- **Format:** Value-first posts, product mention at end\n- **Cadence:** Mon/Wed/Fri"}
       className={textareaCls}
      />
      <p className={hintCls}>The execution plan. This is the only section that changes between iterations.</p>
     </div>

     {/* 6. Eval Method — how you measure */}
     <div>
      <label className={labelCls}>Eval Method</label>
      <textarea
       value={evalMethod}
       onChange={(e) => setEvalMethod(e.target.value)}
       rows={4}
       placeholder={"- **What:** Signups attributed via UTM + Reddit engagement (upvotes, comments)\n- **Frequency:** Every 48h after each post"}
       className={textareaCls}
      />
      <p className={hintCls}>Does not change between iterations. If you change how you measure, start a new experiment.</p>
     </div>

     {/* 7. Decision Triggers — when to pivot/kill/scale */}
     <div>
      <label className={labelCls}>Decision Triggers</label>
      <textarea
       value={decisionTriggers}
       onChange={(e) => setDecisionTriggers(e.target.value)}
       rows={4}
       placeholder={"- **Minimum runtime:** 2 weeks (6 posts)\n- **Pivot:** <2 signups after 4 posts but high engagement\n- **Kill:** Zero signups and <10 upvotes avg after 6 posts\n- **Scale:** 5+ signups/post consistently\n- **Max iterations:** 4 playbook revisions"}
       className={textareaCls}
      />
     </div>

     {/* 8. Constraints — guardrails */}
     <div>
      <label className={labelCls}>Constraints</label>
      <textarea
       value={constraints}
       onChange={(e) => setConstraints(e.target.value)}
       rows={3}
       placeholder={"Max 1 post/day per subreddit. 90/10 value-to-promotional ratio. No identical cross-posts."}
       className={textareaCls}
      />
     </div>

     {/* Preview */}
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
          <div className="text-[14px] font-medium text-cyan-400">{targetValue}</div>
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

    {/* Footer */}
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
