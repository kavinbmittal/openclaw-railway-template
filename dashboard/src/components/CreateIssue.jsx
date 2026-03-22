/**
 * CreateIssue — inline form for creating a new issue.
 * UI ported from Aura HTML reference.
 */
import { useState } from"react";
import { X, CircleDot } from"lucide-react";
import { createIssue } from"../api.js";
import { ALL_PRIORITIES } from"./PriorityIcon.jsx";
import { AGENTS } from"./AssigneeSelect.jsx";

const PRIORITY_DOTS = {
 critical:"bg-red-500",
 high:"bg-orange-500",
 medium:"bg-blue-500",
 low:"bg-zinc-500",
 none:"border border-muted-foreground/40 bg-transparent",
};

export function CreateIssue({ projectSlug, onCreated, onClose, themes = [] }) {
 const [title, setTitle] = useState("");
 const [description, setDescription] = useState("");
 const [priority, setPriority] = useState("medium");
 const [assignee, setAssignee] = useState("");
 const [labelInput, setLabelInput] = useState("");
 const [selectedTheme, setSelectedTheme] = useState("");
 const [selectedProxyMetrics, setSelectedProxyMetrics] = useState([]);
 const [complexity, setComplexity] = useState("complex");
 const [modelOverride, setModelOverride] = useState("");
 const [thinkingOverride, setThinkingOverride] = useState("");
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState(null);

 async function handleSubmit(e) {
  e.preventDefault();
  if (!title.trim()) return;
  setSubmitting(true);
  setError(null);
  try {
   const labels = labelInput.trim()
    ? labelInput.split(",").map((l) => l.trim()).filter(Boolean)
    : [];
   const issue = await createIssue({
    project: projectSlug,
    title: title.trim(),
    description: description.trim(),
    priority,
    assignee: assignee || null,
    labels,
    theme: selectedTheme || null,
    proxy_metrics: selectedProxyMetrics.length > 0 ? selectedProxyMetrics : null,
    complexity,
    model_override: modelOverride || null,
    thinking_override: thinkingOverride || null,
   });
   onCreated?.(issue);
  } catch (err) {
   setError(err.message);
  } finally {
   setSubmitting(false);
  }
 }

 return (
  <div className="bg-card border border-border rounded-[2px] shadow-sm mb-4">
   {/* Card Header — Aura */}
   <div className="flex items-center gap-3 px-5 py-3 bg-violet-500/[0.02] transition-colors">
    <div className="w-6 h-6 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
     <CircleDot className="w-3.5 h-3.5 text-violet-400" />
    </div>
    <div className="text-[15px] font-medium text-violet-100 flex-1">New Issue</div>
    {onClose && (
     <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
      <X size={18} />
     </button>
    )}
   </div>

   {/* Form Body — Aura */}
   <form onSubmit={handleSubmit}>
    <div className="p-[20px] space-y-6">

     {/* Title */}
     <div>
      <label className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2 block">Title</label>
      <input
       type="text"
       value={title}
       onChange={(e) => setTitle(e.target.value)}
       placeholder="Issue title"
       autoFocus
       className="w-full rounded-[6px] border border-border bg-background text-[14px] text-foreground px-3 py-2 placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-all"
      />
     </div>

     {/* Description */}
     <div>
      <label className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2 block">Description</label>
      <textarea
       value={description}
       onChange={(e) => setDescription(e.target.value)}
       rows={4}
       placeholder="Describe the issue in detail. Markdown supported."
       className="w-full rounded-[6px] border border-border bg-background text-[14px] text-foreground px-3 py-2 placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-all resize-y"
      />
     </div>

     {/* Two-column: Priority & Assignee — Aura */}
     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Priority */}
      <div>
       <label className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2 block">Priority</label>
       <div className="relative group">
        <select
         value={priority}
         onChange={(e) => setPriority(e.target.value)}
         className="w-full rounded-[6px] border border-border bg-background text-[14px] text-foreground px-3 py-2 pr-10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-all cursor-pointer appearance-none"
        >
         {ALL_PRIORITIES.map((p) => (
          <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
         ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
         <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
       </div>
      </div>

      {/* Assignee */}
      <div>
       <label className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2 block">Assignee</label>
       <div className="relative group">
        <select
         value={assignee}
         onChange={(e) => setAssignee(e.target.value)}
         className="w-full rounded-[6px] border border-border bg-background text-[14px] text-foreground px-3 py-2 pr-10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-all cursor-pointer appearance-none"
        >
         <option value="">Unassigned</option>
         {AGENTS.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
         ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
         <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
       </div>
      </div>
     </div>

     {/* Theme — Aura */}
     {themes.length > 0 && (
      <div>
       <label className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2 block">Theme</label>
       <div className="relative group">
        <select
         value={selectedTheme}
         onChange={(e) => { setSelectedTheme(e.target.value); setSelectedProxyMetrics([]); }}
         className="w-full rounded-[6px] border border-border bg-background text-[14px] text-foreground px-3 py-2 pr-10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-all cursor-pointer appearance-none"
        >
         <option value="">No theme</option>
         {themes.map((t) => (
          <option key={t.id} value={t.id}>{t.title}</option>
         ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
         <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
       </div>
       <p className="text-[12px] text-muted-foreground mt-1.5">Tag this issue to a strategic theme</p>

       {/* Proxy metrics checkboxes */}
       {selectedTheme && (() => {
        const theme = themes.find((t) => t.id === selectedTheme);
        if (!theme || !theme.proxy_metrics?.length) return null;
        return (
         <div className="mt-3">
          <label className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2 block">Target Proxy Metrics</label>
          <div className="space-y-2">
           {theme.proxy_metrics.map((pm) => (
            <label key={pm.id} className="flex items-center gap-2 text-[14px] cursor-pointer">
             <input
              type="checkbox"
              checked={selectedProxyMetrics.includes(pm.id)}
              onChange={() => {
               setSelectedProxyMetrics((prev) =>
                prev.includes(pm.id) ? prev.filter((id) => id !== pm.id) : [...prev, pm.id]
               );
              }}
              className="accent-teal-400"
             />
             <span className="text-foreground/80">{pm.name}</span>
            </label>
           ))}
          </div>
         </div>
        );
       })()}
      </div>
     )}

     {/* Labels — Aura */}
     <div>
      <label className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2 block">Labels</label>
      <input
       type="text"
       value={labelInput}
       onChange={(e) => setLabelInput(e.target.value)}
       placeholder="Add labels separated by commas"
       className="w-full rounded-[6px] border border-border bg-background text-[14px] text-foreground px-3 py-2 placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-all"
      />
      <p className="text-[12px] text-muted-foreground mt-1.5">Optional tags for categorization</p>
     </div>

     {/* Model Routing */}
     <div>
      <label className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-2 block">Model Routing</label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
       {/* Complexity */}
       <div>
        <label className="text-[11px] text-zinc-500 mb-1.5 block">Complexity</label>
        <div className="relative group">
         <select
          value={complexity}
          onChange={(e) => setComplexity(e.target.value)}
          className="w-full rounded-[6px] border border-border bg-background text-[14px] text-foreground px-3 py-2 pr-10 focus:outline-none focus:ring-[3px] focus:ring-ring/50 transition-all cursor-pointer appearance-none"
         >
          <option value="simple">Simple</option>
          <option value="complex">Complex</option>
          <option value="strategic">Strategic</option>
         </select>
         <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
         </div>
        </div>
       </div>

       {/* Model Override */}
       <div>
        <label className="text-[11px] text-zinc-500 mb-1.5 block">Model Override</label>
        <div className="relative group">
         <select
          value={modelOverride}
          onChange={(e) => { setModelOverride(e.target.value); if (!e.target.value) setThinkingOverride(""); }}
          className="w-full rounded-[6px] border border-border bg-background text-[14px] text-foreground px-3 py-2 pr-10 focus:outline-none focus:ring-[3px] focus:ring-ring/50 transition-all cursor-pointer appearance-none"
         >
          <option value="">Auto</option>
          <option value="anthropic/claude-opus-4-6">Opus 4.6</option>
          <option value="anthropic/claude-sonnet-4-6">Sonnet 4.6</option>
          <option value="anthropic/claude-haiku-4-5">Haiku 4.5</option>
         </select>
         <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
         </div>
        </div>
       </div>

       {/* Thinking Override — only when model override is set */}
       {modelOverride && (
        <div>
         <label className="text-[11px] text-zinc-500 mb-1.5 block">Thinking</label>
         <div className="relative group">
          <select
           value={thinkingOverride}
           onChange={(e) => setThinkingOverride(e.target.value)}
           className="w-full rounded-[6px] border border-border bg-background text-[14px] text-foreground px-3 py-2 pr-10 focus:outline-none focus:ring-[3px] focus:ring-ring/50 transition-all cursor-pointer appearance-none"
          >
           <option value="">Auto</option>
           <option value="off">Off</option>
           <option value="minimal">Minimal</option>
           <option value="low">Low</option>
           <option value="medium">Medium</option>
           <option value="high">High</option>
           <option value="xhigh">Extra High</option>
           <option value="adaptive">Adaptive</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
           <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
         </div>
        </div>
       )}
      </div>
      {modelOverride && (
       <p className="text-[12px] text-amber-400/80 mt-2">This issue will run on {modelOverride.split("/")[1]?.replace(/-/g, " ") || modelOverride} regardless of routing defaults.</p>
      )}
      {!modelOverride && (
       <p className="text-[12px] text-muted-foreground mt-1.5">Complexity drives the default model tier. Override to force a specific model.</p>
      )}
     </div>
    </div>

    {/* Error */}
    {error && (
     <div className="mx-[20px] mb-4 border border-red-500/20 bg-red-500/5 rounded-[2px] px-4 py-3 text-[15px] text-red-400">
      {error}
     </div>
    )}

    {/* Card Footer — Aura */}
    <div className="p-[20px] border-t border-border flex justify-end gap-3">
     {onClose && (
      <button
       type="button"
       onClick={onClose}
       className="px-4 py-2 rounded-[6px] border border-border bg-card text-[15px] font-medium text-foreground/80 hover:bg-accent transition-colors"
      >
       Cancel
      </button>
     )}
     <button
      type="submit"
      disabled={!title.trim() || submitting}
      className="px-4 py-2 rounded-[6px] border border-emerald-500/50 bg-emerald-500/10 text-[15px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
     >
      {submitting ?"Creating..." :"Create Issue"}
     </button>
    </div>
   </form>
  </div>
 );
}
