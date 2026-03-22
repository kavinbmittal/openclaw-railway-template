/**
 * Costs — overview of costs across all projects.
 * Route: /mc/costs
 * Inspired by Paperclip's Costs page layout.
 */

import { useState, useEffect } from"react";
import { getCostOverview } from"../api.js";
import { DollarSign } from"lucide-react";
import { Skeleton } from"../components/ui/Skeleton.jsx";
import { CostOverview } from"../components/CostOverview.jsx";
import { ProjectCostCard } from"../components/ProjectCostCard.jsx";
import { EmptyState } from"../components/EmptyState.jsx";

export default function Costs({ navigate }) {
 const [data, setData] = useState(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);

 useEffect(() => {
  getCostOverview()
   .then(setData)
   .catch((e) => setError(e.message))
   .finally(() => setLoading(false));
 }, []);

 if (loading) {
  return (
   <div className="max-w-[1400px] mx-auto space-y-6">
    <div className="h-12" />
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-1">
     {[1, 2, 3, 4].map((i) => (
      <div key={i} className="bg-card rounded-[2px] border border-border shadow-sm p-[20px]">
       <Skeleton className="h-4 w-20 mb-3" />
       <Skeleton className="h-8 w-16" />
      </div>
     ))}
    </div>
    <div className="space-y-2">
     {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-32 w-full" />
     ))}
    </div>
   </div>
  );
 }

 if (error) {
  return (
   <div className="max-w-[1400px] mx-auto flex items-center justify-center h-64">
    <p className="text-[14px] text-destructive">Error: {error}</p>
   </div>
  );
 }

 const projects = data?.projects || [];
 const totals = data?.totals || { spend: 0, budget: 0, utilizationPct: 0 };

 // Sort: exceeded first, then warning, then healthy; within each group by spend descending
 const statusOrder = { exceeded: 0, warning: 1, healthy: 2 };
 const sortedProjects = [...projects].sort((a, b) => {
  const oa = statusOrder[a.status] ?? 2;
  const ob = statusOrder[b.status] ?? 2;
  if (oa !== ob) return oa - ob;
  return b.totalSpend - a.totalSpend;
 });

 return (
  <div className="max-w-[1400px] mx-auto space-y-6">
   {/* Breadcrumb bar */}
   <div className="h-12 flex items-center">
    <h1 className="text-base font-semibold uppercase tracking-wider">Costs</h1>
   </div>

   {/* Overview summary cards */}
   <CostOverview totals={totals} />

   {/* Per-project breakdown */}
   <div>
    <h3 className="text-[14px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
     Projects
    </h3>

    {sortedProjects.length === 0 ? (
     <EmptyState
      icon={DollarSign}
      text="No cost data yet"
      sub="Agents will begin reporting costs once projects are active."
     />
    ) : (
     <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {sortedProjects.map((project) => (
       <ProjectCostCard
        key={project.project}
        project={project}
        onClick={() => navigate("project", project.project)}
       />
      ))}
     </div>
    )}
   </div>
  </div>
 );
}
