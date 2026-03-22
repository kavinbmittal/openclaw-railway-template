/**
 * ExperimentDetail — full experiment view with Aura HTML styling.
 * Two-panel layout: left column (hypothesis, program, run history),
 * right column (metrics, info, actions).
 */
import { useState, useEffect } from"react";
import { getExperiment } from"../api.js";
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
  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
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
    <header className="sticky top-0 z-10 px-8 py-8 border-b border-zinc-800 shrink-0 bg-[#09090b]">
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
    <header className="sticky top-0 z-10 px-8 py-8 border-b border-zinc-800 shrink-0 bg-[#09090b]">
     <div className="text-sm text-zinc-400 tracking-wide">
      <a href="#/overview" onClick={(e) => { e.preventDefault(); navigate("overview"); }} className="hover:text-zinc-200 transition-colors cursor-pointer">Projects</a>
      <span className="mx-1.5">/</span>
      <span>{projectSlug}</span>
     </div>
    </header>
    <div className="flex-1 flex items-center justify-center">
     <p className="text-sm text-red-400">{error}</p>
    </div>
   </div>
  );
 }

 const { name, status, hypothesis, proxy_metric, target_value, theme, program_md, results, result_count, best_metric } = data;

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
   <header className="sticky top-0 z-10 px-8 py-8 border-b border-zinc-800 shrink-0 bg-[#09090b] flex flex-col gap-4">
    {/* Breadcrumb */}
    <div className="text-sm text-zinc-400 tracking-wide">
     <a href="#/overview" onClick={(e) => { e.preventDefault(); navigate("overview"); }} className="hover:text-zinc-200 transition-colors cursor-pointer">Projects</a>
     <span className="mx-1.5">/</span>
     <a href={`#/projects/${projectSlug}`} onClick={(e) => { e.preventDefault(); navigate("project", projectSlug); }} className="hover:text-zinc-200 transition-colors cursor-pointer">{projectSlug}</a>
     <span className="mx-1.5">/</span>
     <a href={`#/projects/${projectSlug}/experiments`} onClick={(e) => { e.preventDefault(); navigate("project-tab", { slug: projectSlug, tab: "experiments" }); }} className="hover:text-zinc-200 transition-colors cursor-pointer">Experiments</a>
     <span className="mx-1.5">/</span>
     <span className="text-zinc-200">{name}</span>
    </div>

    {/* Title + status */}
    <div className="flex items-center gap-4">
     <h1 className="text-3xl font-medium text-zinc-100 leading-none tracking-tight">{name}</h1>
     <StatusBadge status={status} />
    </div>

    {/* Metadata pills */}
    <div className="flex items-center gap-4 text-sm text-zinc-400 flex-wrap">
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
      <div className="bg-[#121214] border border-zinc-800 rounded-sm shadow-sm p-5">
       <div className="text-xs uppercase font-mono tracking-widest text-zinc-500 mb-1.5">Created</div>
       <div className="text-sm text-zinc-200">{data.created || "Unknown"}</div>
      </div>

      {/* Theme & Proxy Metric grid */}
      {(theme || proxy_metric) && (
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {theme && (
         <div className="bg-[#121214] border border-zinc-800 rounded-sm shadow-sm p-5">
          <div className="text-xs uppercase font-mono tracking-widest text-zinc-500 mb-1.5">Theme</div>
          <div className="text-sm text-zinc-200 flex items-center gap-2">
           <ThemeDot theme={theme} />
           {theme}
          </div>
         </div>
        )}
        {proxy_metric && (
         <div className="bg-[#121214] border border-zinc-800 rounded-sm shadow-sm p-5">
          <div className="text-xs uppercase font-mono tracking-widest text-zinc-500 mb-1.5">Proxy Metric</div>
          <div className="text-sm text-zinc-200">{proxy_metric}</div>
         </div>
        )}
       </div>
      )}

      {/* Hypothesis card */}
      {hypothesis && (
       <div className="bg-[#121214] border border-zinc-800 rounded-sm shadow-sm">
        <div className="px-5 py-4 border-b border-zinc-800">
         <h2 className="text-sm font-medium text-zinc-100">Hypothesis</h2>
        </div>
        <div className="p-5">
         <div className="border-l-2 border-zinc-700 pl-4 py-1 text-sm text-zinc-300 leading-relaxed italic">
          {hypothesis}
         </div>
        </div>
       </div>
      )}

      {/* Program card */}
      {program_md && (
       <div className="bg-[#121214] border border-zinc-800 rounded-sm shadow-sm">
        <div className="px-5 py-4 border-b border-zinc-800 flex justify-between items-center">
         <h2 className="text-sm font-medium text-zinc-100">Program</h2>
         <button className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Edit</button>
        </div>
        <div className="p-5 text-sm text-zinc-300 leading-relaxed space-y-4">
         <Markdown content={program_md} />
        </div>
       </div>
      )}

      {/* Run History card */}
      <div className="bg-[#121214] border border-zinc-800 rounded-sm shadow-sm">
       <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
        <h2 className="text-sm font-medium text-zinc-100">Run History</h2>
        <span className="text-xs font-mono bg-zinc-800 px-1.5 py-0.5 rounded-sm text-zinc-400">{result_count}</span>
       </div>
       {results.length === 0 ? (
        <div className="p-8 text-center text-sm text-zinc-500">No runs recorded yet</div>
       ) : (
        <div className="overflow-x-auto">
         <table className="w-full text-left border-collapse">
          <thead>
           <tr>
            <th className="text-xs font-mono uppercase tracking-widest text-zinc-500 py-3 px-5 border-b border-zinc-800 font-normal">#</th>
            {resultHeaders.map((h) => (
             <th key={h} className="text-xs font-mono uppercase tracking-widest text-zinc-500 py-3 px-5 border-b border-zinc-800 font-normal">{h}</th>
            ))}
           </tr>
          </thead>
          <tbody>
           {results.map((row, idx) => {
            const metricVal = metricCol ? parseFloat(row[metricCol]) : NaN;
            const isBest = metricCol && !isNaN(metricVal) && best_metric !== null && metricVal === best_metric;
            return (
             <tr key={idx} className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${isBest ? "bg-zinc-800/10" : ""}`}>
              <td className={`px-5 py-3.5 text-sm text-zinc-400 font-mono ${isBest ? "border-l-2 border-emerald-500 pl-[18px]" : ""}`}>
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
                <td key={h} className={`px-5 py-3.5 text-sm ${colorClass}`}>
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
      <div className="bg-[#121214] border border-zinc-800 rounded-sm shadow-sm p-5 space-y-6">
       {target_value && (
        <div>
         <div className="text-xs uppercase font-mono tracking-widest text-zinc-500 mb-1.5">Target Value</div>
         <div className="text-sm font-normal text-cyan-400">{target_value}</div>
        </div>
       )}
       {best_metric !== null && (
        <div>
         <div className="text-xs uppercase font-mono tracking-widest text-zinc-500 mb-1.5">Current Best</div>
         <div className="flex items-baseline gap-3">
          <div className="text-3xl font-medium text-emerald-400 font-mono tracking-tight">{best_metric}</div>
         </div>
         {trend && (
          <div className={`flex items-center gap-1 mt-2 ${trend.direction === "up" ? "text-emerald-400" : "text-red-400"}`}>
           <span className="text-xs font-medium">{trend.direction === "up" ? "+" : ""}{trend.value.toFixed(1)}% vs baseline</span>
          </div>
         )}
        </div>
       )}
       <div className="pt-4 border-t border-zinc-800/50 flex justify-between items-center">
        <span className="text-xs uppercase font-mono tracking-widest text-zinc-500">Total Runs</span>
        <span className="text-sm font-mono text-zinc-200">{result_count}</span>
       </div>
      </div>

      {/* Last Run card */}
      <div className="bg-[#121214] border border-zinc-800 rounded-sm shadow-sm p-5">
       <div className="text-xs uppercase font-mono tracking-widest text-zinc-500 mb-1.5">Last Run</div>
       <div className="text-sm text-zinc-200">{results.length > 0 ? "Just now" : "No runs yet"}</div>
      </div>

      {/* Actions card */}
      <div className="bg-[#121214] border border-zinc-800 rounded-sm shadow-sm p-4 flex flex-col gap-2">
       <button className="w-full py-2 px-3 rounded-md border border-cyan-500/30 bg-cyan-500/10 text-sm text-cyan-400 hover:bg-cyan-500/20 transition-colors">
        Re-run Experiment
       </button>
       <button className="w-full py-2 px-3 rounded-md border border-amber-500/30 bg-amber-500/10 text-sm text-amber-400 hover:bg-amber-500/20 transition-colors">
        Pause Experiment
       </button>
       <button className="w-full py-2 px-3 rounded-md border border-red-500/20 bg-red-500/10 text-sm text-red-400 hover:bg-red-500/20 transition-colors mt-2">
        Delete Experiment
       </button>
      </div>
     </div>

    </div>
   </div>
  </div>
 );
}
