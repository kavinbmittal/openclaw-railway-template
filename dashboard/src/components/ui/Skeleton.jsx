export function Skeleton({ className ="", ...props }) {
 return (
  <div
   className={`bg-accent/75 animate-pulse ${className}`}
   {...props}
  />
 );
}
