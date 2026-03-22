const VARIANT_CLASSES = {
 default:"bg-primary text-primary-foreground",
 secondary:"bg-secondary text-secondary-foreground",
 destructive:"bg-destructive text-white",
 outline:"border-border text-foreground",
 ghost:"",
};

export function Badge({ variant ="default", className ="", children, ...props }) {
 return (
  <span
   className={`inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-[12px] font-medium w-fit whitespace-nowrap shrink-0 gap-1 overflow-hidden ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.default} ${className}`}
   {...props}
  >
   {children}
  </span>
 );
}
