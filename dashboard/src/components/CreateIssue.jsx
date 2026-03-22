/**
 * CreateIssue — form for creating a new issue.
 */
import { useState } from"react";
import { X, Plus } from"lucide-react";
import { createIssue } from"../api.js";
import { ALL_PRIORITIES, PriorityIcon } from"./PriorityIcon.jsx";
import { AGENTS, AgentInitial } from"./AssigneeSelect.jsx";

export function CreateIssue({ projectSlug, onCreated, onClose, themes = [] }) {
 const [title, setTitle] = useState("");
 const [description, setDescription] = useState("");
 const [priority, setPriority] = useState("none");
 const [assignee, setAssignee] = useState("");
 const [labelInput, setLabelInput] = useState("");
 const [labels, setLabels] = useState([]);
 const [selectedTheme, setSelectedTheme] = useState("");
 const [selectedProxyMetrics, setSelectedProxyMetrics] = useState([]);
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState(null);

 function addLabel() {
  const trimmed = labelInput.trim();
  if (trimmed && !labels.includes(trimmed)) {
   setLabels([...labels, trimmed]);
   setLabelInput("");
  }
 }

 function removeLabel(label) {
  setLabels(labels.filter((l) => l !== label));
 }

 function handleLabelKeyDown(e) {
  if (e.key ==="Enter") {
   e.preventDefault();
   addLabel();
  }
 }

 async function handleSubmit(e) {
  e.preventDefault();
  if (!title.trim()) return;
  setSubmitting(true);
  setError(null);
  try {
   const issue = await createIssue({
    project: projectSlug,
    title: title.trim(),
    description: description.trim(),
    priority,
    assignee: assignee || null,
    labels,
    theme: selectedTheme || null,
    proxy_metrics: selectedProxyMetrics.length > 0 ? selectedProxyMetrics : null,
   });
   onCreated?.(issue);
  } catch (err) {
   setError(err.message);
  } finally {
   setSubmitting(false);
  }
 }

 return (
  <div className="border border-border bg-card">
   <div className="flex items-center justify-between px-4 py-3 border-b border-border">
    <h3 className="text-sm font-semibold">New Issue</h3>
    {onClose && (
     <button
      onClick={onClose}
      className="text-muted-foreground hover:text-foreground transition-colors"
     >
      <X className="h-4 w-4" />
     </button>
    )}
   </div>

   <form onSubmit={handleSubmit} className="p-4 space-y-4">
    {/* Title */}
    <div>
     <input
      type="text"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      placeholder="Issue title"
      className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground/40"
      autoFocus
     />
    </div>

    {/* Description */}
    <div>
     <textarea
      value={description}
      onChange={(e) => setDescription(e.target.value)}
      placeholder="Add a description..."
      className="w-full min-h-[100px] rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 resize-y"
     />
    </div>

    {/* Properties row */}
    <div className="flex flex-wrap gap-3">
     {/* Priority */}
     <div>
      <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
      <select
       value={priority}
       onChange={(e) => setPriority(e.target.value)}
       className="rounded border border-border bg-transparent px-2 py-1.5 text-xs outline-none"
      >
       {ALL_PRIORITIES.map((p) => (
        <option key={p} value={p}>
         {p.charAt(0).toUpperCase() + p.slice(1)}
        </option>
       ))}
      </select>
     </div>

     {/* Assignee */}
     <div>
      <label className="text-xs text-muted-foreground mb-1 block">Assignee</label>
      <select
       value={assignee}
       onChange={(e) => setAssignee(e.target.value)}
       className="rounded border border-border bg-transparent px-2 py-1.5 text-xs outline-none"
      >
       <option value="">Unassigned</option>
       {AGENTS.map((a) => (
        <option key={a.id} value={a.id}>
         {a.name}
        </option>
       ))}
      </select>
     </div>
    </div>

    {/* Theme + Proxy Metrics — only shown when project has approved themes */}
    {themes.length > 0 && (
     <div className="space-y-3">
      <div>
       <label className="text-xs text-muted-foreground mb-1 block">Theme</label>
       <select
        value={selectedTheme}
        onChange={(e) => {
         setSelectedTheme(e.target.value);
         setSelectedProxyMetrics([]); // reset metrics when theme changes
        }}
        className="border border-border bg-transparent px-2 py-1.5 text-xs outline-none"
       >
        <option value="">Select theme...</option>
        {themes.map((t) => (
         <option key={t.id} value={t.id}>{t.title}</option>
        ))}
       </select>
      </div>
      {selectedTheme && (() => {
       const theme = themes.find((t) => t.id === selectedTheme);
       if (!theme || !theme.proxy_metrics?.length) return null;
       return (
        <div>
         <label className="text-xs text-muted-foreground mb-1 block">Target Proxy Metrics</label>
         <div className="space-y-1.5">
          {theme.proxy_metrics.map((pm) => (
           <label key={pm.id} className="flex items-center gap-2 text-xs cursor-pointer">
            <input
             type="checkbox"
             checked={selectedProxyMetrics.includes(pm.id)}
             onChange={() => {
              setSelectedProxyMetrics((prev) =>
               prev.includes(pm.id)
                ? prev.filter((id) => id !== pm.id)
                : [...prev, pm.id]
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

    {/* Labels */}
    <div>
     <label className="text-xs text-muted-foreground mb-1 block">Labels</label>
     <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
      {labels.map((label) => (
       <span
        key={label}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-accent text-accent-foreground"
       >
        {label}
        <button
         type="button"
         onClick={() => removeLabel(label)}
         className="text-muted-foreground hover:text-foreground"
        >
         <X className="h-3 w-3" />
        </button>
       </span>
      ))}
     </div>
     <div className="flex items-center gap-1">
      <input
       type="text"
       value={labelInput}
       onChange={(e) => setLabelInput(e.target.value)}
       onKeyDown={handleLabelKeyDown}
       placeholder="Add label..."
       className="flex-1 rounded border border-border bg-transparent px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50"
      />
      <button
       type="button"
       onClick={addLabel}
       className="p-1.5 rounded border border-border hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
      >
       <Plus className="h-3 w-3" />
      </button>
     </div>
    </div>

    {error && (
     <p className="text-xs text-destructive">{error}</p>
    )}

    {/* Submit */}
    <div className="flex justify-end">
     <button
      type="submit"
      disabled={!title.trim() || submitting}
      className="inline-flex items-center px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
     >
      {submitting ?"Creating..." :"Create Issue"}
     </button>
    </div>
   </form>
  </div>
 );
}
