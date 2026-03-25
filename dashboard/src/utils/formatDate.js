export function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;

  const day = d.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st'
    : day === 2 || day === 22 ? 'nd'
    : day === 3 || day === 23 ? 'rd'
    : 'th';

  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  const year = d.getFullYear();

  return `${dayName}, ${day}${suffix} ${month} ${year}`;
}

export function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;

  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${formatDate(dateStr)} at ${time}`;
}

/**
 * Formats a target date as friendly relative text with urgency color class.
 * Returns { text, colorClass } or null if no date.
 */
export function formatTargetDate(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00"); // treat as local date
  if (isNaN(target)) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((target - today) / 86400000);

  if (diffDays < 0) return { text: "overdue", colorClass: "text-red-400" };
  if (diffDays === 0) return { text: "today", colorClass: "text-amber-400" };
  if (diffDays === 1) return { text: "tomorrow", colorClass: "text-amber-400" };
  if (diffDays <= 30) return { text: `in ${diffDays} days`, colorClass: "text-muted-foreground" };
  // 31+ days — show "Mon DD"
  const month = target.toLocaleDateString("en-US", { month: "short" });
  const day = target.getDate();
  return { text: `${month} ${day}`, colorClass: "text-muted-foreground" };
}

export function formatTimeAgo(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(dateStr);
}
