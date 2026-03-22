import { useState, createContext, useContext } from"react";

const TabsContext = createContext({ value:"", onChange: () => {} });

export function Tabs({ value, onValueChange, defaultValue, className ="", children }) {
 const [internal, setInternal] = useState(defaultValue ||"");
 const activeValue = value !== undefined ? value : internal;
 const handleChange = onValueChange || setInternal;

 return (
  <TabsContext.Provider value={{ value: activeValue, onChange: handleChange }}>
   <div className={`flex flex-col gap-2 ${className}`}>
    {children}
   </div>
  </TabsContext.Provider>
 );
}

export function TabsList({ className ="", children, ...props }) {
 return (
  <div
   className={`inline-flex w-fit items-center gap-0 border-b border-border ${className}`}
   role="tablist"
   {...props}
  >
   {children}
  </div>
 );
}

export function TabsTrigger({ value, className ="", children, ...props }) {
 const { value: activeValue, onChange } = useContext(TabsContext);
 const isActive = activeValue === value;

 return (
  <button
   role="tab"
   aria-selected={isActive}
   onClick={() => onChange(value)}
   className={`relative flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium transition-colors ${
    isActive
     ?"text-foreground after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-foreground"
     :"text-muted-foreground hover:text-foreground"
   } ${className}`}
   {...props}
  >
   {children}
  </button>
 );
}

export function TabsContent({ value, className ="", children, ...props }) {
 const { value: activeValue } = useContext(TabsContext);
 if (activeValue !== value) return null;

 return (
  <div className={`flex-1 outline-none ${className}`} {...props}>
   {children}
  </div>
 );
}
