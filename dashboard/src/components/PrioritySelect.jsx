/**
 * PrioritySelect — dropdown for changing issue priority.
 */
import { useState, useRef, useEffect } from"react";
import { PriorityIcon, ALL_PRIORITIES } from"./PriorityIcon.jsx";

function priorityLabel(p) {
 return (p ||"none").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PrioritySelect({ value, onChange, className ="" }) {
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
    <PriorityIcon priority={value} />
    {priorityLabel(value)}
   </button>
   {open && (
    <div className="absolute z-50 mt-1 w-40 rounded-[6px] border border-border bg-card p-1 shadow-lg">
     {ALL_PRIORITIES.map((p) => (
      <button
       key={p}
       className={`flex items-center gap-2 w-full px-2 py-1.5 text-[12px] rounded hover:bg-accent/50 transition-colors text-left ${
        p === value ?"bg-accent" :""
       }`}
       onClick={() => {
        onChange(p);
        setOpen(false);
       }}
      >
       <PriorityIcon priority={p} />
       {priorityLabel(p)}
      </button>
     ))}
    </div>
   )}
  </div>
 );
}
