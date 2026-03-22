import { useState } from"react";
import { createProject } from"../api.js";
import { ArrowLeft, Plus, Loader2 } from"lucide-react";

const LEADS = [
 { id:"binny", label:"Binny — Lia PM" },
 { id:"kiko", label:"Kiko — Celestial PM, Design" },
 { id:"leslie", label:"Leslie — Growth, Outreach" },
 { id:"zara", label:"Zara — Design, UX, Research" },
 { id:"ritam", label:"Ritam — Researcher" },
 { id:"midas", label:"Midas — Crypto" },
];

const DEFAULT_GATES = [
 { id:"deploy-production", label:"Deploy to production", checked: true },
 { id:"scope-change", label:"Scope changes", checked: true },
 { id:"external-integration", label:"External integrations", checked: true },
 { id:"autoresearch-start", label:"Start autoresearch experiment", checked: true },
 { id:"single-task-over-50", label:"Single task over $50", checked: false },
];

export default function CreateProject({ navigate }) {
 const [name, setName] = useState("");
 const [mission, setMission] = useState("");
 const [nsm, setNsm] = useState("");
 const [lead, setLead] = useState("binny");
 const [budget, setBudget] = useState("500");
 const [gates, setGates] = useState(DEFAULT_GATES);
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState(null);

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
   const { slug } = await createProject({
    name: name.trim(),
    mission: mission.trim(),
    nsm: nsm.trim() || null,
    lead,
    budget: parseInt(budget) || 200,
    gates,
   });
   navigate("project", slug);
  } catch (err) {
   setError(err.message);
   setSubmitting(false);
  }
 }

 return (
  <div className="space-y-6 max-w-2xl">
   {/* Breadcrumb */}
   <div className="h-12 flex items-center gap-2">
    <button
     onClick={() => navigate("overview")}
     className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
    >
     Dashboard
    </button>
    <span className="text-muted-foreground/40">›</span>
    <span className="text-[13px] font-semibold text-foreground">New Project</span>
   </div>

   <div>
    <h2 className="text-xl font-semibold text-foreground">Create Project</h2>
    <p className="text-sm text-muted-foreground mt-1">
     Assign a lead, set a budget, and define approval gates.
    </p>
   </div>

   <form onSubmit={handleSubmit} className="space-y-5">
    {/* Name */}
    <div className="space-y-1.5">
     <label className="text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground">
      Project Name
     </label>
     <input
      type="text"
      value={name}
      onChange={(e) => setName(e.target.value)}
      placeholder="e.g., Lia Retrieval v2"
      required
      className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
     />
    </div>

    {/* Mission */}
    <div className="space-y-1.5">
     <label className="text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground">
      Mission / Goal
     </label>
     <textarea
      value={mission}
      onChange={(e) => setMission(e.target.value)}
      placeholder="What should this project achieve?"
      required
      rows={3}
      className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors resize-none"
     />
    </div>

    {/* North Star Metric */}
    <div className="space-y-1.5">
     <label className="text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground">
      North Star Metric
     </label>
     <input
      type="text"
      value={nsm}
      onChange={(e) => setNsm(e.target.value)}
      placeholder="e.g., Paying customers with >7 day retention"
      className="w-full px-3 py-2 text-sm bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
     />
     <p className="text-[11px] text-muted-foreground/60">
      How you measure progress against this mission. Combine quantity and quality.
     </p>
    </div>

    {/* Lead */}
    <div className="space-y-1.5">
     <label className="text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground">
      Lead
     </label>
     <select
      value={lead}
      onChange={(e) => setLead(e.target.value)}
      className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground focus:outline-none focus:border-ring transition-colors"
     >
      {LEADS.map((l) => (
       <option key={l.id} value={l.id}>
        {l.label}
       </option>
      ))}
     </select>
    </div>

    {/* Budget */}
    <div className="space-y-1.5">
     <label className="text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground">
      Budget ($/week)
     </label>
     <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">$</span>
      <input
       type="number"
       value={budget}
       onChange={(e) => setBudget(e.target.value)}
       min="0"
       step="50"
       className="w-32 px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground font-mono tabular-nums focus:outline-none focus:border-ring transition-colors"
      />
      <span className="text-sm text-muted-foreground">/ week</span>
     </div>
    </div>

    {/* Approval Gates */}
    <div className="space-y-1.5">
     <label className="text-[11px] uppercase tracking-[0.16em] font-mono text-muted-foreground">
      Approval Gates
     </label>
     <div className="border border-border divide-y divide-border">
      {gates.map((gate) => (
       <label
        key={gate.id}
        className="flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer hover:bg-accent/50 transition-colors"
       >
        <input
         type="checkbox"
         checked={gate.checked}
         onChange={() => toggleGate(gate.id)}
         className="accent-foreground"
        />
        <span className="text-foreground/80">{gate.label}</span>
        <span className="ml-auto text-xs text-muted-foreground font-mono">
         requires kavin
        </span>
       </label>
      ))}
     </div>
    </div>

    {/* Error */}
    {error && (
     <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
      {error}
     </div>
    )}

    {/* Submit */}
    <div className="flex items-center gap-3 pt-2">
     <button
      type="submit"
      disabled={submitting || !name.trim() || !mission.trim()}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
     >
      {submitting ? (
       <Loader2 size={14} className="animate-spin" />
      ) : (
       <Plus size={14} />
      )}
      {submitting ?"Creating..." :"Create Project"}
     </button>
     <button
      type="button"
      onClick={() => navigate("overview")}
      className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
     >
      Cancel
     </button>
    </div>
   </form>
  </div>
 );
}
