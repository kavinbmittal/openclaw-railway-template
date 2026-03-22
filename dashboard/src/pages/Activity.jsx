import { useState, useEffect, useMemo } from"react";
import { getActivity, getProjects } from"../api.js";
import { History, Search } from"lucide-react";
import { Skeleton } from"../components/ui/Skeleton.jsx";
import { EmptyState } from"../components/EmptyState.jsx";
import { ActivityTimeline } from"../components/ActivityTimeline.jsx";
import { FilterBar } from"../components/FilterBar.jsx";

const EVENT_TYPES = [
 { value:"all", label:"All types" },
 { value:"issue_update", label:"Issues" },
 { value:"approval_approved", label:"Approved" },
 { value:"approval_rejected", label:"Rejected" },
 { value:"standup", label:"Standups" },
 { value:"activity", label:"Activity" },
];

export default function Activity({ navigate }) {
 const [events, setEvents] = useState([]);
 const [projects, setProjects] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [searchQuery, setSearchQuery] = useState("");
 const [filterProject, setFilterProject] = useState("");
 const [filterAgent, setFilterAgent] = useState("");
 const [filterType, setFilterType] = useState("all");

 useEffect(() => {
  Promise.all([
   getActivity({ limit: 500, project: filterProject || undefined, agent: filterAgent || undefined }),
   getProjects(),
  ])
   .then(([evts, projs]) => {
    setEvents(evts);
    setProjects(projs);
   })
   .catch((e) => setError(e.message))
   .finally(() => setLoading(false));
 }, [filterProject, filterAgent]);

 const agents = useMemo(() => {
  const set = new Set();
  for (const e of events) {
   if (e.agent) set.add(e.agent);
  }
  return [...set].sort();
 }, [events]);

 const filteredEvents = useMemo(() => {
  let result = events;
  if (filterType !=="all") {
   result = result.filter((e) => e.type === filterType);
  }
  if (searchQuery.trim()) {
   const q = searchQuery.toLowerCase();
   result = result.filter(
    (e) =>
     (e.description ||"").toLowerCase().includes(q) ||
     (e.agent ||"").toLowerCase().includes(q) ||
     (e.project ||"").toLowerCase().includes(q)
   );
  }
  return result;
 }, [events, filterType, searchQuery]);

 const activeFilters = useMemo(() => {
  const filters = [];
  if (filterProject) filters.push({ key:"project", label:"Project", value: filterProject });
  if (filterAgent) filters.push({ key:"agent", label:"Agent", value: filterAgent });
  if (filterType !=="all") {
   const t = EVENT_TYPES.find((et) => et.value === filterType);
   filters.push({ key:"type", label:"Type", value: t?.label || filterType });
  }
  return filters;
 }, [filterProject, filterAgent, filterType]);

 function handleRemoveFilter(key) {
  if (key ==="project") setFilterProject("");
  if (key ==="agent") setFilterAgent("");
  if (key ==="type") setFilterType("all");
 }

 function handleClearFilters() {
  setFilterProject("");
  setFilterAgent("");
  setFilterType("all");
  setSearchQuery("");
 }

 if (loading) {
  return (
   <div className="max-w-[1400px] mx-auto space-y-6">
    <div className="h-12 flex items-center">
     <h1 className="text-base font-semibold uppercase tracking-wider">Activity</h1>
    </div>
    <div className="space-y-2">
     {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="border border-border p-3">
       <Skeleton className="h-4 w-full mb-1" />
       <Skeleton className="h-3 w-48" />
      </div>
     ))}
    </div>
   </div>
  );
 }

 return (
  <div className="max-w-[1400px] mx-auto space-y-6">
   {/* Header */}
   <div className="h-12 flex items-center justify-between">
    <h1 className="text-base font-semibold uppercase tracking-wider">Activity</h1>
    <span className="text-[12px] text-muted-foreground">
     {filteredEvents.length} events
    </span>
   </div>

   {/* Filter row */}
   <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
    {/* Search */}
    <div className="relative flex-1 max-w-xs">
     <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
     <input
      type="text"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder="Search activity..."
      className="w-full pl-8 pr-3 py-1.5 text-[12px] rounded-[6px] bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-[color,box-shadow]"
     />
    </div>

    {/* Dropdowns */}
    <div className="flex items-center gap-2 flex-wrap">
     <select
      value={filterProject}
      onChange={(e) => setFilterProject(e.target.value)}
      className="h-7 px-2 text-[12px] rounded-[6px] bg-background border border-border text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-[color,box-shadow]"
     >
      <option value="">All projects</option>
      {projects.map((p) => (
       <option key={p.id} value={p.id}>{p.title || p.id}</option>
      ))}
     </select>

     <select
      value={filterAgent}
      onChange={(e) => setFilterAgent(e.target.value)}
      className="h-7 px-2 text-[12px] rounded-[6px] bg-background border border-border text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-[color,box-shadow]"
     >
      <option value="">All agents</option>
      {agents.map((a) => (
       <option key={a} value={a}>{a}</option>
      ))}
     </select>

     <select
      value={filterType}
      onChange={(e) => setFilterType(e.target.value)}
      className="h-7 px-2 text-[12px] rounded-[6px] bg-background border border-border text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-[color,box-shadow]"
     >
      {EVENT_TYPES.map((t) => (
       <option key={t.value} value={t.value}>{t.label}</option>
      ))}
     </select>
    </div>
   </div>

   {/* Active filter chips */}
   <FilterBar
    filters={activeFilters}
    onRemove={handleRemoveFilter}
    onClear={handleClearFilters}
   />

   {/* Errors */}
   {error && (
    <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-[14px] text-red-400">
     {error}
    </div>
   )}

   {/* Timeline */}
   {filteredEvents.length === 0 ? (
    <EmptyState
     icon={History}
     text="No activity yet"
     sub="Activity will appear here as agents work across projects."
    />
   ) : (
    <ActivityTimeline events={filteredEvents} onNavigate={navigate} />
   )}
  </div>
 );
}
