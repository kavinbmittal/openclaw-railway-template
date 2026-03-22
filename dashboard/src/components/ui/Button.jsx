const VARIANT_CLASSES = {
 default:"bg-primary text-primary-foreground hover:bg-primary/90",
 destructive:"bg-destructive text-white hover:bg-destructive/90",
 outline:"border bg-background hover:bg-accent hover:text-accent-foreground",
 secondary:"bg-secondary text-secondary-foreground hover:bg-secondary/80",
 ghost:"hover:bg-accent hover:text-accent-foreground",
 link:"text-primary underline-offset-4 hover:underline",
};

const SIZE_CLASSES = {
 default:"h-10 px-4 py-2",
 xs:"h-6 gap-1 px-2 text-[12px]",
 sm:"h-9 gap-1.5 px-3",
 lg:"h-10 px-6",
 icon:"size-10",
"icon-sm":"size-9",
};

export function Button({ variant ="default", size ="default", className ="", children, ...props }) {
 return (
  <button
   className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] text-[14px] font-medium transition-[color,background-color,border-color,box-shadow,opacity] disabled:pointer-events-none disabled:opacity-50 shrink-0 outline-none ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.default} ${SIZE_CLASSES[size] || SIZE_CLASSES.default} ${className}`}
   {...props}
  >
   {children}
  </button>
 );
}
