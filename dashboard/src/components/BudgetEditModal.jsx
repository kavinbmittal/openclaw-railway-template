/**
 * BudgetEditModal — modal form for editing budget policy.
 * Inspired by Paperclip's BudgetPolicyCard save section.
 */

import { useState, useEffect } from"react";
import { X, AlertTriangle, ShieldAlert, Wallet } from"lucide-react";

export function BudgetEditModal({ project, policy, onSave, onClose, saving = false }) {
 const [weeklyBudget, setWeeklyBudget] = useState("");
 const [warnThreshold, setWarnThreshold] = useState(80);
 const [stopThreshold, setStopThreshold] = useState(100);
 const [perAgentLimits, setPerAgentLimits] = useState([]);

 useEffect(() => {
  if (policy) {
   setWeeklyBudget(String(policy.weekly_budget_usd ||""));
   setWarnThreshold(Math.round((policy.warn_threshold || 0.8) * 100));
   setStopThreshold(Math.round((policy.stop_threshold || 1.0) * 100));
   const limits = policy.per_agent_limits || {};
   setPerAgentLimits(
    Object.entries(limits).map(([agent, limit]) => ({ agent, limit: String(limit) }))
   );
  }
 }, [policy]);

 const handleAddAgent = () => {
  setPerAgentLimits([...perAgentLimits, { agent:"", limit:"" }]);
 };

 const handleRemoveAgent = (index) => {
  setPerAgentLimits(perAgentLimits.filter((_, i) => i !== index));
 };

 const handleAgentChange = (index, field, value) => {
  const updated = [...perAgentLimits];
  updated[index] = { ...updated[index], [field]: value };
  setPerAgentLimits(updated);
 };

 const handleSubmit = (e) => {
  e.preventDefault();
  const budget = parseFloat(weeklyBudget);
  if (isNaN(budget) || budget < 0) return;

  const limits = {};
  for (const { agent, limit } of perAgentLimits) {
   if (agent.trim() && limit.trim()) {
    const val = parseFloat(limit);
    if (!isNaN(val) && val >= 0) limits[agent.trim()] = val;
   }
  }

  onSave({
   project,
   weekly_budget_usd: budget,
   warn_threshold: warnThreshold / 100,
   stop_threshold: stopThreshold / 100,
   per_agent_limits: Object.keys(limits).length > 0 ? limits : undefined,
  });
 };

 const budgetNum = parseFloat(weeklyBudget);
 const isValid = !isNaN(budgetNum) && budgetNum >= 0;

 return (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
   {/* Backdrop */}
   <div className="absolute inset-0 bg-black/60" onClick={onClose} />

   {/* Modal */}
   <div className="relative bg-background border border-border w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
    {/* Header */}
    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
     <div className="flex items-center gap-2">
      <Wallet size={16} className="text-muted-foreground" />
      <h3 className="text-[14px] font-semibold">Edit Budget Policy</h3>
     </div>
     <button
      onClick={onClose}
      className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
     >
      <X size={16} />
     </button>
    </div>

    {/* Body */}
    <form onSubmit={handleSubmit} className="px-5 py-4 space-y-5">
     {/* Weekly budget */}
     <div>
      <label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground block mb-2">
       Weekly Budget (USD)
      </label>
      <div className="relative">
       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[14px]">
        $
       </span>
       <input
        type="number"
        min="0"
        step="0.01"
        value={weeklyBudget}
        onChange={(e) => setWeeklyBudget(e.target.value)}
        className="w-full bg-background border border-border px-3 py-2 pl-7 text-[14px] font-mono tabular-nums focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-shadow"
        placeholder="0.00"
       />
      </div>
     </div>

     {/* Warning threshold */}
     <div>
      <label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground block mb-2">
       <span className="flex items-center gap-1.5">
        <AlertTriangle size={10} className="text-amber-400" />
        Warning threshold
       </span>
      </label>
      <div className="flex items-center gap-3">
       <input
        type="range"
        min="0"
        max="100"
        value={warnThreshold}
        onChange={(e) => setWarnThreshold(Number(e.target.value))}
        className="flex-1 accent-amber-400"
       />
       <span className="text-[14px] font-mono tabular-nums w-12 text-right text-foreground">
        {warnThreshold}%
       </span>
      </div>
     </div>

     {/* Stop threshold */}
     <div>
      <label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground block mb-2">
       <span className="flex items-center gap-1.5">
        <ShieldAlert size={10} className="text-red-400" />
        Stop threshold
       </span>
      </label>
      <div className="flex items-center gap-3">
       <input
        type="range"
        min="0"
        max="150"
        value={stopThreshold}
        onChange={(e) => setStopThreshold(Number(e.target.value))}
        className="flex-1 accent-red-400"
       />
       <span className="text-[14px] font-mono tabular-nums w-12 text-right text-foreground">
        {stopThreshold}%
       </span>
      </div>
     </div>

     {/* Per-agent limits */}
     <div>
      <div className="flex items-center justify-between mb-2">
       <label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Per-Agent Limits
       </label>
       <button
        type="button"
        onClick={handleAddAgent}
        className="text-[11px] text-primary hover:text-primary/80 transition-colors"
       >
        + Add agent
       </button>
      </div>
      {perAgentLimits.length === 0 ? (
       <p className="text-[12px] text-muted-foreground/50 italic">
        No per-agent limits configured.
       </p>
      ) : (
       <div className="space-y-2">
        {perAgentLimits.map((item, i) => (
         <div key={i} className="flex items-center gap-2">
          <input
           type="text"
           value={item.agent}
           onChange={(e) => handleAgentChange(i,"agent", e.target.value)}
           className="flex-1 bg-background border border-border px-3 py-1.5 text-[14px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-shadow"
           placeholder="Agent name"
          />
          <div className="relative w-28">
           <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[12px]">
            $
           </span>
           <input
            type="number"
            min="0"
            step="0.01"
            value={item.limit}
            onChange={(e) => handleAgentChange(i,"limit", e.target.value)}
            className="w-full bg-background border border-border px-3 py-1.5 pl-5 text-[14px] font-mono tabular-nums focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-shadow"
            placeholder="0.00"
           />
          </div>
          <button
           type="button"
           onClick={() => handleRemoveAgent(i)}
           className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors shrink-0"
          >
           <X size={14} />
          </button>
         </div>
        ))}
       </div>
      )}
     </div>

     {/* Validation error */}
     {weeklyBudget && !isValid && (
      <p className="text-[12px] text-destructive">Enter a valid non-negative dollar amount.</p>
     )}

     {/* Actions */}
     <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
      <button
       type="button"
       onClick={onClose}
       className="px-4 py-2 text-[14px] text-muted-foreground hover:text-foreground transition-colors"
      >
       Cancel
      </button>
      <button
       type="submit"
       disabled={!isValid || saving}
       className="px-4 py-2 text-[14px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
       {saving ?"Saving..." : policy ?"Update Budget" :"Set Budget"}
      </button>
     </div>
    </form>
   </div>
  </div>
 );
}
