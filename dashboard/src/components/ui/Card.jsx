function Card({ className ="", children, ...props }) {
 return (
  <div
   className={`bg-card text-card-foreground flex flex-col gap-6 rounded-[2px] border p-[20px] shadow-sm ${className}`}
   {...props}
  >
   {children}
  </div>
 );
}

function CardHeader({ className ="", children, ...props }) {
 return (
  <div
   className={`grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 ${className}`}
   {...props}
  >
   {children}
  </div>
 );
}

function CardTitle({ className ="", children, ...props }) {
 return (
  <div className={`leading-none font-semibold ${className}`} {...props}>
   {children}
  </div>
 );
}

function CardDescription({ className ="", children, ...props }) {
 return (
  <div className={`text-muted-foreground text-[14px] ${className}`} {...props}>
   {children}
  </div>
 );
}

function CardContent({ className ="", children, ...props }) {
 return (
  <div className={`px-6 ${className}`} {...props}>
   {children}
  </div>
 );
}

function CardFooter({ className ="", children, ...props }) {
 return (
  <div className={`flex items-center px-6 ${className}`} {...props}>
   {children}
  </div>
 );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
