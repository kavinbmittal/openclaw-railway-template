/**
 * StatusSelect — dropdown for changing issue status.
 * Adapted from Paperclip's StatusIcon with popover.
 */
import { useState, useRef, useEffect } from"react";
import { StatusBadge } from"./StatusBadge.jsx";

export const ALL_STATUSES = ["proposed","backlog","todo","in_progress","in_review","done","cancelled"];

const STATUS_CIRCLE = {
 backlog:"border-muted-foreground/40",
 todo:"border-blue-400",
 in_progress:"border-yellow-400",
 in_review:"border-violet-400",
 done:"border-green-400",
 cancelled:"border-muted-foreground/40",
};

function statusLabel(status) {
 return (status ||"unknown").replace(/_/g,"").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusCircle({ status, className ="" }) {
 const isDone = status ==="done";
 return (
  <span
   className={`relative inline-flex h-4 w-4 rounded-full border-2 shrink-0 ${STATUS_CIRCLE[status] || STATUS_CIRCLE.backlog} ${className}`}
  >
   {isDone && (
    <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-green-400" />
   )}
  </span>
 );
}

export function StatusSelect({ value, onChange, className ="" }) {
 const [open, setOpen] = useState(false);
 const ref = useRef(null);

 useEffect(() => {
  if (!open) return;
  function handleClick(e) {
   if (ref.current && !ref.current.contains(e.target)) setOpen(false);
  }
  document.addEventListener("mousedown", handleClick);
  return () => document.removeEventListener("mousedown", handleClick);
 }, [open]);

 return (
  <div className={`relative ${className}`} ref={ref}>
   <button
    onClick={() => setOpen(!open)}
    className="inline-flex items-center gap-1.5 cursor-pointer hover:bg-accent/50 rounded px-1.5 py-1 transition-colors text-[14px]"
   >
    <StatusCircle status={value} />
    {statusLabel(value)}
   </button>
   {open && (
    <div className="absolute z-50 mt-1 w-44 rounded-[6px] border border-border bg-card p-1 shadow-lg">
     {ALL_STATUSES.map((s) => (
      <button
       key={s}
       className={`flex items-center gap-2 w-full px-2 py-1.5 text-[12px] rounded hover:bg-accent/50 transition-colors text-left ${
        s === value ?"bg-accent" :""
       }`}
       onClick={() => {
        onChange(s);
        setOpen(false);
       }}
      >
       <StatusCircle status={s} />
       {statusLabel(s)}
      </button>
     ))}
    </div>
   )}
  </div>
 );
}
