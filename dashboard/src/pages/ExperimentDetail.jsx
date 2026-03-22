/**
 * ExperimentDetail — full experiment view with Aura HTML styling.
 * Two-panel layout: left column (hypothesis, program, run history),
 * right column (metrics, info, actions).
 */
import { useState, useEffect } from"react";
import { getExperiment } from"../api.js";
import { Lightbulb, Code, History } from"lucide-react";
import { Skeleton } from"../components/ui/Skeleton.jsx";
import Markdown from"../components/Markdown.jsx";

/* ── Status badge with animated pulse for running ── */
function StatusBadge({ status }) {
 const s = (status || "unknown").toLowerCase();
 const map = {
  running:"border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  planned:"border-zinc-700 bg-zinc-800/50 text-zinc-400",
  completed:"border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  paused:"border-amber-500/30 bg-amber-500/10 text-amber-400",
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
   {s.charAt(0).toUpperCase() + s.slice(1)}
  </span>
 );
}

/* ── Theme color dot ── */
function ThemeDot({ theme }) {
 if (!theme) return null;
 // Generate a consistent color from the theme string
 const colors = ["bg-cyan-400","bg-emerald-400","bg-amber-400","bg-violet-400","bg-rose-400","bg-blue-400"];
 let hash = 0;
 for (let i = 0; i < theme.length; i++) hash = ((hash << 5) - hash + theme.charCodeAt(i)) | 0;
 const color = colors[Math.abs(hash) % colors.length];
 return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export default function ExperimentDetail({ projectSlug, experimentDir, navigate }) {
 const [data, setData] = useState(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);

 useEffect(() => {
  setLoading(true);
  setError(null);
  getExperiment(experimentDir, projectSlug)
   .then(setData)
   .catch((e) => setError(e.message))
   .finally(() => setLoading(false));
 }, [experimentDir, projectSlug]);

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

 const { name, status, hypothesis, proxy_metric, target_value, theme, program_md, program, proxy_metrics, results, result_count, best_metric } = data;

 // Determine run history table headers dynamically from results
 const resultHeaders = results.length > 0 ? Object.keys(results[0]) : [];

 // Find the metric column (third column) and best value for highlighting
 const metricCol = resultHeaders.length >= 3 ? resultHeaders[2] : null;

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
     <h1 className="text-3xl font-medium text-zinc-100 leading-none tracking-tight">{name}</h1>
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

      {/* Created box */}
      <div className="bg-card border border-border rounded-[2px] shadow-sm p-[20px]">
       <div className="text-[12px] uppercase font-mono tracking-widest text-zinc-500 mb-1.5">Created</div>
       <div className="text-[14px] text-zinc-200">{data.created || "Unknown"}</div>
      </div>

      {/* Theme & Proxy Metric grid */}
      {(theme || proxy_metric) && (
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {theme && (
         <div className="bg-card border border-border rounded-[2px] shadow-sm p-[20px]">
          <div className="text-[12px] uppercase font-mono tracking-widest text-zinc-500 mb-1.5">Theme</div>
          <div className="text-[14px] text-zinc-200 flex items-center gap-2">
           <ThemeDot theme={theme} />
           {theme}
          </div>
         </div>
        )}
        {(proxy_metrics?.length > 0 || proxy_metric) && (
         <div className="bg-card border border-border rounded-[2px] shadow-sm p-[20px]">
          <div className="text-[12px] uppercase font-mono tracking-widest text-zinc-500 mb-1.5">Proxy Metrics</div>
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

      {/* Program card — renders only the ## Program section, not the full file */}
      {(program || program_md) && (
       <div className="bg-card border border-border rounded-[2px] shadow-sm">
        <div className="flex items-center gap-3 px-5 py-3 bg-cyan-500/[0.02] transition-colors">
         <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Code className="w-3.5 h-3.5 text-cyan-400" />
         </div>
         <div className="text-[15px] font-medium text-cyan-100 flex-1">Program</div>
         <button className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">Edit</button>
        </div>
        <div className="p-[20px] text-[14px] text-zinc-300 leading-relaxed space-y-4">
         <Markdown content={program || program_md} />
        </div>
       </div>
      )}

      {/* Run History card */}
      <div className="bg-card border border-border rounded-[2px] shadow-sm">
       <div className="flex items-center gap-3 px-5 py-3 bg-cyan-500/[0.02] transition-colors">
        <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
         <History className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div className="text-[15px] font-medium text-cyan-100">Run History</div>
        <span className="text-[12px] font-mono bg-zinc-800 px-1.5 py-0.5 rounded-[2px] text-zinc-400">{result_count}</span>
       </div>
       {results.length === 0 ? (
        <div className="p-8 text-center text-[14px] text-zinc-500">No runs recorded yet</div>
       ) : (
        <div className="overflow-x-auto">
         <table className="w-full text-left border-collapse">
          <thead>
           <tr>
            <th className="text-[12px] font-mono uppercase tracking-widest text-zinc-500 py-3 px-5 border-b border-border font-normal">#</th>
            {resultHeaders.map((h) => (
             <th key={h} className="text-[12px] font-mono uppercase tracking-widest text-zinc-500 py-3 px-5 border-b border-border font-normal">{h}</th>
            ))}
           </tr>
          </thead>
          <tbody>
           {results.map((row, idx) => {
            const metricVal = metricCol ? parseFloat(row[metricCol]) : NaN;
            const isBest = metricCol && !isNaN(metricVal) && best_metric !== null && metricVal === best_metric;
            return (
             <tr key={idx} className={`border-b border-border/50 hover:bg-zinc-800/30 transition-colors ${isBest ? "bg-zinc-800/10" : ""}`}>
              <td className={`px-5 py-3.5 text-[14px] text-zinc-400 font-mono ${isBest ? "border-l-2 border-emerald-500 pl-[18px]" : ""}`}>
               {idx + 1}
              </td>
              {resultHeaders.map((h) => {
               const val = row[h];
               const numVal = parseFloat(val);
               let colorClass = "text-zinc-300";
               if (h === metricCol && !isNaN(numVal)) {
                if (isBest) colorClass = "text-emerald-400 font-medium";
               }
               return (
                <td key={h} className={`px-5 py-3.5 text-[14px] ${colorClass}`}>
                 {val}
                </td>
               );
              })}
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
         <div className="text-[12px] uppercase font-mono tracking-widest text-zinc-500 mb-1.5">Target Value</div>
         <div className="text-[14px] font-normal text-cyan-400">{target_value}</div>
        </div>
       )}
       {best_metric !== null && (
        <div>
         <div className="text-[12px] uppercase font-mono tracking-widest text-zinc-500 mb-1.5">Current Best</div>
         <div className="flex items-baseline gap-3">
          <div className="text-3xl font-medium text-emerald-400 font-mono tracking-tight">{best_metric}</div>
         </div>
         {trend && (
          <div className={`flex items-center gap-1 mt-2 ${trend.direction === "up" ? "text-emerald-400" : "text-red-400"}`}>
           <span className="text-[12px] font-medium">{trend.direction === "up" ? "+" : ""}{trend.value.toFixed(1)}% vs baseline</span>
          </div>
         )}
        </div>
       )}
       <div className="pt-4 border-t border-border/50 flex justify-between items-center">
        <span className="text-[12px] uppercase font-mono tracking-widest text-zinc-500">Total Runs</span>
        <span className="text-[14px] font-mono text-zinc-200">{result_count}</span>
       </div>
      </div>

      {/* Last Run card */}
      <div className="bg-card border border-border rounded-[2px] shadow-sm p-[20px]">
       <div className="text-[12px] uppercase font-mono tracking-widest text-zinc-500 mb-1.5">Last Run</div>
       <div className="text-[14px] text-zinc-200">{results.length > 0 ? "Just now" : "No runs yet"}</div>
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
