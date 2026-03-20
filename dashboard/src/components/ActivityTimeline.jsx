/**
 * ActivityTimeline — vertical timeline with date grouping.
 */

import { ActivityEvent } from "./ActivityEvent.jsx";

function groupByDate(events) {
  const groups = {};
  for (const event of events) {
    const date = event.timestamp
      ? new Date(event.timestamp).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Unknown date";
    if (!groups[date]) groups[date] = [];
    groups[date].push(event);
  }
  return Object.entries(groups);
}

export function ActivityTimeline({ events, onNavigate }) {
  const grouped = groupByDate(events);

  return (
    <div className="space-y-6">
      {grouped.map(([date, dateEvents]) => (
        <div key={date}>
          {/* Date header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-2 mb-0">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {date}
            </h3>
          </div>

          {/* Events */}
          <div className="border border-border border-t-0 divide-y divide-border">
            {dateEvents.map((event, i) => (
              <ActivityEvent
                key={`${event.timestamp}-${i}`}
                event={event}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
