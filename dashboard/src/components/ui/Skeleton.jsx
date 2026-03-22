export function Skeleton({ className ="", ...props }) {
 return (
  <div
   className={`bg-accent/75 animate-pulse rounded-md ${className}`}
   {...props}
  />
 );
}
