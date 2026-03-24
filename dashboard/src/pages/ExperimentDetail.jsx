/**
 * ExperimentDetail — full experiment view with phase arc and decision-aware run history.
 * Two-panel layout: left column (phase arc, hypothesis, program, run history),
 * right column (metrics, info, actions).
 */
import { useState, useEffect, useRef, useCallback } from"react";
import { getExperiment } from"../api.js";
import { Lightbulb, Code, History, FileText, Activity, Target, AlertTriangle, Wrench, CheckCircle2, XCircle } from"lucide-react";
import { Skeleton } from"../components/ui/Skeleton.jsx";
import Markdown from"../components/Markdown.jsx";

/* ── Decision color map — shared between arc and table ── */
const DECISION_COLORS = {
 keep:  { border: "border-cyan-500",    bg: "bg-cyan-500",    text: "text-cyan-400",    pill: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400",    dot: "bg-cyan-400" },
 pivot: { border: "border-amber-500",   bg: "bg-amber-500",   text: "text-amber-400",   pill: "border-amber-500/20 bg-amber-500/10 text-amber-400",  dot: "bg-amber-400" },
 scale: { border: "border-emerald-500", bg: "bg-emerald-500", text: "text-emerald-400", pill: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400", dot: "bg-emerald-400" },
 kill:  { border: "border-red-500",     bg: "bg-red-500",     text: "text-red-400",     pill: "border-red-500/20 bg-red-500/10 text-red-400",      dot: "bg-red-400" },
 pause: { border: "border-orange-500",  bg: "bg-orange-500",  text: "text-orange-400",  pill: "border-orange-500/20 bg-orange-500/10 text-orange-400", dot: "bg-orange-400" },
};

/* ── Status badge with animated pulse for running ── */
function StatusBadge({ status }) {
 const s = (status || "unknown").toLowerCase();
 const map = {
  running:"border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  planned:"border-zinc-700 bg-zinc-800/50 text-zinc-400",
  completed:"border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  killed:"border-red-500/30 bg-red-500/10 text-red-400",
  paused:"border-orange-500/30 bg-orange-500/10 text-orange-400",
 };
 const cls = map[s] || "border-zinc-700 bg-zinc-800/50 text-zinc-400";
 return (
  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${cls}`}>
   {s === "running" && (
    <span className="relative flex h-2 w-2">
     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
     <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
    </span>
   )}
   {s === "paused" && (
    <span className="relative flex h-2 w-2">
     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
     <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-400" />
    </span>
   )}
   {s.charAt(0).toUpperCase() + s.slice(1)}
  </span>
 );
}

/* ── Theme color dot ── */
function ThemeDot({ theme }) {
 if (!theme) return null;
 const colors = ["bg-cyan-400","bg-emerald-400","bg-amber-400","bg-violet-400","bg-rose-400","bg-blue-400"];
 let hash = 0;
 for (let i = 0; i < theme.length; i++) hash = ((hash << 5) - hash + theme.charCodeAt(i)) | 0;
 const color = colors[Math.abs(hash) % colors.length];
 return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

/* ── Decision badge pill ── */
function DecisionBadge({ decision }) {
 if (!decision) return null;
 const d = decision.toLowerCase().trim();
 const colors = DECISION_COLORS[d];
 if (!colors) return <span className="text-[12px] text-zinc-400">{decision}</span>;
 return (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${colors.pill}`}>
   {d.charAt(0).toUpperCase() + d.slice(1)}
  </span>
 );
}

/* ── Phase Arc — horizontal step indicator ── */
function PhaseArc({ phases, onPhaseClick }) {
 if (!phases || phases.length === 0) return null;

 const isTerminal = (type) => type === "kill" || type === "scale";
 const lastPhase = phases[phases.length - 1];
 const experimentDone = isTerminal(lastPhase.type);

 return (
  <div className="bg-card border border-border rounded-[2px] shadow-sm p-[20px]">
   <div className="flex items-center overflow-x-auto gap-0">
    {phases.map((phase, idx) => {
     const isLast = idx === phases.length - 1;
     const isCurrent = isLast && !experimentDone;
     const isPast = !isLast || experimentDone;
     const colors = DECISION_COLORS[phase.type];

     // Determine dot color
     let dotColor = "bg-zinc-600"; // dimmed future
     if (isPast) dotColor = colors ? colors.dot : "bg-cyan-400";
     if (isCurrent) dotColor = colors ? colors.dot : "bg-cyan-400";

     // Label
     let label = phase.type === "design" ? "Design"
      : phase.type === "run" ? `Run ${phase.number}`
      : phase.type.charAt(0).toUpperCase() + phase.type.slice(1);

     return (
      <div key={idx} className="flex items-center shrink-0">
       {/* Node */}
       <button
        onClick={() => onPhaseClick(phase, idx)}
        className="flex flex-col items-center gap-1.5 group cursor-pointer"
       >
        <div className="relative flex items-center justify-center">
         {/* Pulse ring for current phase */}
         {isCurrent && (
          <span className={`animate-ping absolute inline-flex h-4 w-4 rounded-full ${dotColor} opacity-30`} />
         )}
         <span className={`relative inline-flex rounded-full ${isCurrent ? "h-3.5 w-3.5" : "h-2.5 w-2.5"} ${dotColor} ${isPast ? "opacity-100" : "opacity-40"}`} />
        </div>
        <span className={`text-[11px] font-mono tracking-wide ${isPast || isCurrent ? (colors ? colors.text : "text-cyan-400") : "text-zinc-600"} group-hover:text-zinc-200 transition-colors`}>
         {label}
        </span>
       </button>
       {/* Connecting line */}
       {!isLast && (
        <div className={`w-10 h-px mx-1 ${isPast ? "bg-zinc-600" : "bg-zinc-800"}`} />
       )}
      </div>
     );
    })}
   </div>
  </div>
 );
}

export default function ExperimentDetail({ projectSlug, experimentDir, navigate }) {
 const [data, setData] = useState(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const rowRefs = useRef({});

 useEffect(() => {
  setLoading(true);
  setError(null);
  getExperiment(experimentDir, projectSlug)
   .then(setData)
   .catch((e) => setError(e.message))
   .finally(() => setLoading(false));
 }, [experimentDir, projectSlug]);

 // Map phase index to the corresponding table row index for click-to-scroll
 const phaseToRowMap = useCallback((phases, results) => {
  if (!phases || !results) return {};
  const map = {};
  const validDecisions = ["keep", "pivot", "scale", "kill"];
  let runStartRow = 0;
  let decisionIdx = 0;

  for (let pi = 0; pi < phases.length; pi++) {
   const phase = phases[pi];
   if (phase.type === "design") continue;
   if (phase.type === "run") {
    // Find first result row for this run
    // Runs start after the previous decision row
    map[pi] = runStartRow;
   } else if (validDecisions.includes(phase.type)) {
    // Find the result row with this decision
    for (let ri = runStartRow; ri < results.length; ri++) {
     const d = (results[ri].decision || "").toLowerCase().trim();
     if (d === phase.type) {
      map[pi] = ri;
      runStartRow = ri + 1;
      decisionIdx++;
      break;
     }
    }
   }
  }
  return map;
 }, []);

 const handlePhaseClick = useCallback((phase, phaseIdx) => {
  if (!data) return;
  const map = phaseToRowMap(data.phases, data.results);
  const rowIdx = map[phaseIdx];
  if (rowIdx !== undefined && rowRefs.current[rowIdx]) {
   rowRefs.current[rowIdx].scrollIntoView({ behavior: "smooth", block: "center" });
  }
 }, [data, phaseToRowMap]);

 if (loading) {
  return (
   <div className="flex flex-col h-full">
    <header className="sticky top-0 z-10 px-8 py-8 border-b border-border shrink-0 bg-background/80 backdrop-blur-sm">
     <Skeleton className="h-4 w-48 mb-4" />
     <Skeleton className="h-8 w-72" />
    </header>
    <div className="flex-1 overflow-y-auto p-8">
     <div className="max-w-[1200px] mx-auto grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 flex flex-col gap-6">
       <Skeleton className="h-16 w-full" />
       <Skeleton className="h-40 w-full" />
       <Skeleton className="h-60 w-full" />
      </div>
      <div className="flex flex-col gap-6">
       <Skeleton className="h-48 w-full" />
       <Skeleton className="h-32 w-full" />
      </div>
     </div>
    </div>
   </div>
  );
 }

 if (error) {
  return (
   <div className="flex flex-col h-full">
    <header className="sticky top-0 z-10 px-8 py-8 border-b border-border shrink-0 bg-background/80 backdrop-blur-sm">
     <div className="text-[14px] text-zinc-400 tracking-wide">
      <a href="#/overview" onClick={(e) => { e.preventDefault(); navigate("overview"); }} className="hover:text-zinc-200 transition-colors cursor-pointer">Projects</a>
      <span className="mx-2 text-zinc-600">&rsaquo;</span>
      <span>{projectSlug}</span>
     </div>
    </header>
    <div className="flex-1 flex items-center justify-center">
     <p className="text-[14px] text-red-400">{error}</p>
    </div>
   </div>
  );
 }

 const { name, status, hypothesis, proxy_metric, target_value, theme, program_md, program, proxy_metrics, results, result_count, best_metric, phases, playbook, eval_method, decision_triggers, constraints, required_tools } = data;

 // Determine run history table headers dynamically from results
 // Filter out decision/reason from the main numeric columns — they get special rendering
 const allHeaders = results.length > 0 ? Object.keys(results[0]) : [];
 const dataHeaders = allHeaders.filter((h) => h !== "decision" && h !== "reason");
 const hasDecisions = allHeaders.includes("decision");

 // Find the metric column (third column, excluding date and exp) and best value for highlighting
 const metricCol = dataHeaders.length >= 3 ? dataHeaders[2] : null;

 // Calculate trend from last two results
 let trend = null;
 if (metricCol && results.length >= 2) {
  const last = parseFloat(results[results.length - 1][metricCol]);
  const prev = parseFloat(results[results.length - 2][metricCol]);
  if (!isNaN(last) && !isNaN(prev) && prev !== 0) {
   const pct = ((last - prev) / Math.abs(prev)) * 100;
   trend = { value: pct, direction: pct >= 0 ? "up" : "down" };
  }
 }

 return (
  <div className="flex flex-col h-full">
   {/* ── Sticky Header ── */}
   <header className="sticky top-0 z-10 px-8 py-8 border-b border-border shrink-0 bg-background/80 backdrop-blur-sm flex flex-col gap-4">
    {/* Breadcrumb */}
    <div className="text-[14px] text-zinc-400 tracking-wide">
     <a href="#/overview" onClick={(e) => { e.preventDefault(); navigate("overview"); }} className="hover:text-zinc-200 transition-colors cursor-pointer">Projects</a>
     <span className="mx-2 text-zinc-600">&rsaquo;</span>
     <a href={`#/projects/${projectSlug}`} onClick={(e) => { e.preventDefault(); navigate("project", projectSlug); }} className="hover:text-zinc-200 transition-colors cursor-pointer">{projectSlug}</a>
     <span className="mx-2 text-zinc-600">&rsaquo;</span>
     <a href={`#/projects/${projectSlug}/experiments`} onClick={(e) => { e.preventDefault(); navigate("project-tab", { slug: projectSlug, tab: "experiments" }); }} className="hover:text-zinc-200 transition-colors cursor-pointer">Experiments</a>
     <span className="mx-2 text-zinc-600">&rsaquo;</span>
     <span className="text-zinc-200">{name}</span>
    </div>

    {/* Title + status */}
    <div className="flex items-center gap-4">
     <h1 className="text-[30px] font-semibold text-foreground leading-none tracking-tight">{name}</h1>
     <StatusBadge status={status} />
    </div>

    {/* Metadata pills */}
    <div className="flex items-center gap-4 text-[14px] text-zinc-400 flex-wrap">
     {theme && (
      <span className="flex items-center gap-1.5">
       <ThemeDot theme={theme} />
       {theme}
      </span>
     )}
     {proxy_metric && (
      <span>Metric: <span className="text-zinc-300">{proxy_metric}</span></span>
     )}
     {target_value && (
      <span>Target: <span className="text-zinc-300">{target_value}</span></span>
     )}
     <span>{result_count} run{result_count !== 1 ? "s" : ""}</span>
    </div>
   </header>

   {/* ── Scrollable Content ── */}
   <div className="flex-1 overflow-y-auto p-8">
    <div className="max-w-[1200px] mx-auto grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

     {/* ── Left Column ── */}
     <div className="xl:col-span-2 flex flex-col gap-6">

      {/* Phase Arc */}
      <PhaseArc phases={phases} onPhaseClick={handlePhaseClick} />

      {/* Created box */}
      <div className="bg-card border border-border rounded-[2px] shadow-sm p-[20px]">
       <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-1.5">Created</div>
       <div className="text-[14px] text-zinc-200">{data.created || "Unknown"}</div>
      </div>

      {/* Theme & Proxy Metric grid */}
      {(theme || proxy_metric) && (
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {theme && (
         <div className="bg-card border border-border rounded-[2px] shadow-sm p-[20px]">
          <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-1.5">Theme</div>
          <div className="text-[14px] text-zinc-200 flex items-center gap-2">
           <ThemeDot theme={theme} />
           {theme}
          </div>
         </div>
        )}
        {(proxy_metrics?.length > 0 || proxy_metric) && (
         <div className="bg-card border border-border rounded-[2px] shadow-sm p-[20px]">
          <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-1.5">Proxy Metrics</div>
          {proxy_metrics?.length > 0 ? (
           <div className="space-y-2">
            {proxy_metrics.map((pm) => (
             <div key={pm.id} className="flex items-baseline justify-between text-[14px]">
              <span className="text-zinc-200">{pm.name}</span>
              {pm.target && <span className="text-zinc-400 text-[12px] font-mono">{pm.target}</span>}
             </div>
            ))}
           </div>
          ) : (
           <div className="text-[14px] text-zinc-200">{proxy_metric}{target_value && <span className="text-zinc-400 ml-2 text-[12px] font-mono">{target_value}</span>}</div>
          )}
         </div>
        )}
       </div>
      )}

      {/* Hypothesis card */}
      {hypothesis && (
       <div className="bg-card border border-border rounded-[2px] shadow-sm">
        <div className="flex items-center gap-3 px-5 py-3 bg-cyan-500/[0.02] transition-colors">
         <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Lightbulb className="w-3.5 h-3.5 text-cyan-400" />
         </div>
         <div className="text-[15px] font-medium text-cyan-100">Hypothesis</div>
        </div>
        <div className="p-[20px]">
         <div className="border-l-2 border-zinc-700 pl-4 py-1 text-[14px] text-zinc-300 leading-relaxed italic">
          {hypothesis}
         </div>
        </div>
       </div>
      )}

      {/* Playbook card */}
      {playbook && (
       <div className="bg-card border border-border rounded-[2px] shadow-sm">
        <div className="flex items-center gap-3 px-5 py-3 bg-cyan-500/[0.02] transition-colors">
         <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <FileText className="w-3.5 h-3.5 text-cyan-400" />
         </div>
         <div className="text-[15px] font-medium text-cyan-100 flex-1">Playbook</div>
        </div>
        <div className="p-[20px] text-[14px] text-zinc-300 leading-relaxed space-y-4 mc-prose">
         <Markdown content={playbook} />
        </div>
       </div>
      )}

      {/* Required Tools card */}
      {required_tools && required_tools.length > 0 && (
       <div className="bg-card border border-border rounded-[2px] shadow-sm">
        <div className="flex items-center gap-3 px-5 py-3 bg-cyan-500/[0.02] transition-colors">
         <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Wrench className="w-3.5 h-3.5 text-cyan-400" />
         </div>
         <div className="text-[15px] font-medium text-cyan-100">Required Tools</div>
         {required_tools.some((t) => !t.checked) && (
          <span className="ml-auto text-[11px] font-mono text-red-400 uppercase tracking-widest">Blocked</span>
         )}
        </div>
        <div className="p-[20px] space-y-2">
         {required_tools.map((tool, i) => (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-[2px] border ${tool.checked ? "border-border/60 bg-zinc-800/10" : "border-red-500/20 bg-red-500/5"}`}>
           {tool.checked
            ? <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
            : <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />}
           <span className={`text-[13px] font-mono leading-relaxed ${tool.checked ? "text-zinc-300" : "text-red-300"}`}>{tool.description}</span>
          </div>
         ))}
        </div>
       </div>
      )}

      {/* Eval Method card */}
      {eval_method && (
       <div className="bg-card border border-border rounded-[2px] shadow-sm">
        <div className="flex items-center gap-3 px-5 py-3 bg-cyan-500/[0.02] transition-colors">
         <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
         </div>
         <div className="text-[15px] font-medium text-cyan-100 flex-1">Eval Method</div>
        </div>
        <div className="p-[20px] text-[14px] text-zinc-300 leading-relaxed space-y-4 mc-prose">
         <Markdown content={eval_method} />
        </div>
       </div>
      )}

      {/* Decision Triggers card */}
      {decision_triggers && (
       <div className="bg-card border border-border rounded-[2px] shadow-sm">
        <div className="flex items-center gap-3 px-5 py-3 bg-cyan-500/[0.02] transition-colors">
         <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Target className="w-3.5 h-3.5 text-cyan-400" />
         </div>
         <div className="text-[15px] font-medium text-cyan-100 flex-1">Decision Triggers</div>
        </div>
        <div className="p-[20px] text-[14px] text-zinc-300 leading-relaxed space-y-4 mc-prose">
         <Markdown content={decision_triggers} />
        </div>
       </div>
      )}

      {/* Constraints card */}
      {constraints && (
       <div className="bg-card border border-border rounded-[2px] shadow-sm">
        <div className="flex items-center gap-3 px-5 py-3 bg-cyan-500/[0.02] transition-colors">
         <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <AlertTriangle className="w-3.5 h-3.5 text-cyan-400" />
         </div>
         <div className="text-[15px] font-medium text-cyan-100 flex-1">Constraints</div>
        </div>
        <div className="p-[20px] text-[14px] text-zinc-300 leading-relaxed space-y-4 mc-prose">
         <Markdown content={constraints} />
        </div>
       </div>
      )}

      {/* Legacy: Program card for old experiments without structured sections */}
      {!playbook && !eval_method && (program || program_md) && (
       <div className="bg-card border border-border rounded-[2px] shadow-sm">
        <div className="flex items-center gap-3 px-5 py-3 bg-cyan-500/[0.02] transition-colors">
         <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Code className="w-3.5 h-3.5 text-cyan-400" />
         </div>
         <div className="text-[15px] font-medium text-cyan-100 flex-1">Program</div>
        </div>
        <div className="p-[20px] text-[14px] text-zinc-300 leading-relaxed space-y-4">
         <Markdown content={program || program_md} />
        </div>
       </div>
      )}

      {/* Run History card — unified table with decision columns */}
      <div className="bg-card border border-border rounded-[2px] shadow-sm">
       <div className="flex items-center gap-3 px-5 py-3 bg-cyan-500/[0.02] transition-colors">
        <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
         <History className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div className="text-[15px] font-medium text-cyan-100">Run History</div>
        <span className="text-[10px] font-mono bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-[2px] text-cyan-400">{result_count}</span>
       </div>
       {results.length === 0 ? (
        <div className="p-8 text-center text-[14px] text-muted-foreground">No runs recorded yet</div>
       ) : (
        <div className="overflow-x-auto">
         <table className="w-full text-left border-collapse">
          <thead>
           <tr>
            <th className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground py-3 px-[20px] border-b border-border font-normal">#</th>
            {dataHeaders.map((h) => (
             <th key={h} className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground py-3 px-[20px] border-b border-border font-normal">{h}</th>
            ))}
            {hasDecisions && (
             <>
              <th className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground py-3 px-[20px] border-b border-border font-normal">Decision</th>
              <th className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground py-3 px-[20px] border-b border-border font-normal">Reason</th>
             </>
            )}
           </tr>
          </thead>
          <tbody>
           {results.map((row, idx) => {
            const metricVal = metricCol ? parseFloat(row[metricCol]) : NaN;
            const isBest = metricCol && !isNaN(metricVal) && best_metric !== null && metricVal === best_metric;
            const decision = (row.decision || "").toLowerCase().trim();
            const hasDecision = decision && DECISION_COLORS[decision];
            const decisionColors = hasDecision ? DECISION_COLORS[decision] : null;

            // Row border accent: decision color takes priority, then best metric emerald
            let borderClass = "";
            if (hasDecision) borderClass = `border-l-2 ${decisionColors.border} pl-[18px]`;
            else if (isBest) borderClass = "border-l-2 border-emerald-500 pl-[18px]";

            return (
             <tr
              key={idx}
              ref={(el) => { rowRefs.current[idx] = el; }}
              className={`border-b border-border/50 hover:bg-accent/40 transition-colors ${isBest && !hasDecision ? "bg-zinc-800/10" : ""} ${hasDecision ? "bg-zinc-800/20" : ""}`}
             >
              <td className={`px-[20px] py-3.5 text-[14px] text-zinc-400 font-mono ${borderClass}`}>
               {idx + 1}
              </td>
              {dataHeaders.map((h) => {
               const val = row[h];
               const numVal = parseFloat(val);
               let colorClass = "text-zinc-300";
               if (h === metricCol && !isNaN(numVal)) {
                if (isBest) colorClass = "text-emerald-400 font-medium";
               }
               return (
                <td key={h} className={`px-[20px] py-3.5 text-[14px] ${colorClass}`}>
                 {val}
                </td>
               );
              })}
              {hasDecisions && (
               <>
                <td className="px-[20px] py-3.5">
                 <DecisionBadge decision={row.decision} />
                </td>
                <td className="px-[20px] py-3.5 text-[14px] text-zinc-400 italic max-w-[300px]">
                 {row.reason || ""}
                </td>
               </>
              )}
             </tr>
            );
           })}
          </tbody>
         </table>
        </div>
       )}
      </div>
     </div>

     {/* ── Right Column ── */}
     <div className="xl:col-span-1 sticky top-0 flex flex-col gap-6">

      {/* Metrics card */}
      <div className="bg-card border border-border rounded-[2px] shadow-sm p-[20px] space-y-6">
       {target_value && (
        <div>
         <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-1.5">Target Value</div>
         <div className="text-[14px] font-normal text-cyan-400">{target_value}</div>
        </div>
       )}
       {best_metric !== null && (
        <div>
         <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-1.5">Current Best</div>
         <div className="flex items-baseline gap-3">
          <div className="text-[30px] font-semibold text-emerald-400 font-mono tracking-tight leading-none">{best_metric}</div>
         </div>
         {trend && (
          <div className={`flex items-center gap-1 mt-2 ${trend.direction === "up" ? "text-emerald-400" : "text-red-400"}`}>
           <span className="text-[12px] font-medium">{trend.direction === "up" ? "+" : ""}{trend.value.toFixed(1)}% vs baseline</span>
          </div>
         )}
        </div>
       )}
       <div className="pt-4 border-t border-border/50 flex justify-between items-center">
        <span className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground">Total Runs</span>
        <span className="text-[14px] font-mono text-zinc-200">{result_count}</span>
       </div>
      </div>

      {/* Last Run card */}
      <div className="bg-card border border-border rounded-[2px] shadow-sm p-[20px]">
       <div className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground mb-1.5">Last Run</div>
       <div className="text-[14px] text-zinc-200">
        {results.length > 0 ? (results[results.length - 1].date || "Unknown") : "No runs yet"}
       </div>
      </div>

      {/* Actions card */}
      <div className="bg-card border border-border rounded-[2px] shadow-sm p-[20px] flex flex-col gap-2">
       <button className="w-full py-2 px-3 rounded-[6px] border border-cyan-500/30 bg-cyan-500/10 text-[14px] text-cyan-400 hover:bg-cyan-500/20 transition-colors">
        Re-run Experiment
       </button>
       <button className="w-full py-2 px-3 rounded-[6px] border border-amber-500/30 bg-amber-500/10 text-[14px] text-amber-400 hover:bg-amber-500/20 transition-colors">
        Pause Experiment
       </button>
       <button className="w-full py-2 px-3 rounded-[6px] border border-red-500/20 bg-red-500/10 text-[14px] text-red-400 hover:bg-red-500/20 transition-colors mt-2">
        Delete Experiment
       </button>
      </div>
     </div>

    </div>
   </div>
  </div>
 );
}
