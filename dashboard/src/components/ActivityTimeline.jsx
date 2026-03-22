/**
 * ActivityTimeline — vertical timeline with date grouping.
 * Latest date group expanded by default, older groups collapsed.
 */

import { useState } from"react";
import { ChevronRight } from"lucide-react";
import { ActivityEvent } from"./ActivityEvent.jsx";
import { formatDate } from"../utils/formatDate.js";

function groupByDate(events) {
 const groups = {};
 for (const event of events) {
  const date = event.timestamp
   ? formatDate(event.timestamp)
   :"Unknown date";
  if (!groups[date]) groups[date] = [];
  groups[date].push(event);
 }
 return Object.entries(groups);
}

function DateGroup({ date, events, defaultOpen, onNavigate }) {
 const [open, setOpen] = useState(defaultOpen);

 return (
  <div>
   {/* Date header — clickable to toggle */}
   <button
    onClick={() => setOpen(!open)}
    className="w-full sticky top-0 z-10 bg-background/95 backdrop-blur-sm border border-border px-4 py-2 flex items-center gap-2 text-left hover:bg-accent/30 transition-colors"
   >
    <ChevronRight
     size={14}
     className={`text-muted-foreground transition-transform duration-150 ${open ?"rotate-90" :""}`}
    />
    <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
     {date}
    </h3>
    <span className="text-[11px] text-muted-foreground/50 ml-auto">
     {events.length} {events.length === 1 ?"event" :"events"}
    </span>
   </button>

   {/* Events */}
   {open && (
    <div className="border border-border border-t-0 divide-y divide-border">
     {events.map((event, i) => (
      <ActivityEvent
       key={`${event.timestamp}-${i}`}
       event={event}
       onNavigate={onNavigate}
      />
     ))}
    </div>
   )}
  </div>
 );
}

export function ActivityTimeline({ events, onNavigate }) {
 const grouped = groupByDate(events);

 return (
  <div className="space-y-2">
   {grouped.map(([date, dateEvents], i) => (
    <DateGroup
     key={date}
     date={date}
     events={dateEvents}
     defaultOpen={i === 0}
     onNavigate={onNavigate}
    />
   ))}
  </div>
 );
}
