/**
 * InboxBadge — red dot/number badge for sidebar nav items.
 */

export function InboxBadge({ count }) {
  if (!count || count <= 0) return null;

  return (
    <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold leading-none px-1">
      {count > 99 ? "99+" : count}
    </span>
  );
}
