import { useState, useEffect, useMemo } from"react";
import {
 LayoutDashboard,
 ShieldCheck,
 ChevronRight,
 Bot,
 Inbox,
 Activity,
 CircleDot,
 DollarSign,
 Network,
 Terminal,
} from"lucide-react";
import { getApprovals, getProjects, getInbox } from"../api.js";

/* ── Predefined project colors (cycled) ────────────────────────────── */
const PROJECT_COLORS = [
"#ec4899", // pink
"#6366f1", // indigo
"#22c55e", // green
"#a855f7", // purple
"#3b82f6", // blue
"#f59e0b", // amber
"#ef4444", // red
"#14b8a6", // teal
];

/* ── Section header (Paperclip style) ──────────────────────────────── */
function SidebarSection({ label, children, collapsible = false, defaultOpen = true, action }) {
 const [open, setOpen] = useState(defaultOpen);

 return (
  <div>
   <div className="group flex items-center px-3 py-1.5">
    {collapsible ? (
     <button
      onClick={() => setOpen(!open)}
      className="flex items-center gap-1 flex-1 min-w-0"
     >
      <ChevronRight
       className={`h-3 w-3 text-muted-foreground/60 transition-transform opacity-0 group-hover:opacity-100 ${
        open ?"rotate-90" :""
       }`}
      />
      <span className="text-[11px] font-medium uppercase tracking-widest font-mono text-muted-foreground/80">
       {label}
      </span>
     </button>
    ) : (
     <span className="flex-1 text-[11px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60">
      {label}
     </span>
    )}
    {action}
   </div>
   {(!collapsible || open) && (
    <div className="flex flex-col gap-0.5 mt-0.5">{children}</div>
   )}
  </div>
 );
}

/* ── Nav item with optional badge (Paperclip style) ────────────────── */
function SidebarNavItem({ active, onClick, icon: Icon, label, badge, badgeTone ="default", children: extraRight }) {
 return (
  <button
   onClick={onClick}
   className={`flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors w-full text-left ${
    active
     ?"bg-accent text-foreground"
     :"text-foreground/80 hover:bg-accent/50 hover:text-foreground"
   }`}
  >
   {Icon && (
    <span className="relative shrink-0">
     <Icon className="h-4 w-4" />
    </span>
   )}
   <span className="flex-1 truncate">{label}</span>
   {extraRight}
   {badge != null && badge > 0 && (
    <span
     className={`ml-auto rounded-full px-1.5 py-0.5 text-xs leading-none ${
      badgeTone ==="danger"
       ?"bg-red-600/90 text-red-50"
       :"bg-primary text-primary-foreground"
     }`}
    >
     {badge}
    </span>
   )}
  </button>
 );
}

/* ── Main sidebar ──────────────────────────────────────────────────── */
export default function Sidebar({ page, selectedProject, navigate, refreshKey }) {
 const [approvalCount, setApprovalCount] = useState(0);
 const [inboxCount, setInboxCount] = useState(0);
 const [projects, setProjects] = useState([]);

 /* Poll approvals */
 useEffect(() => {
  const load = () =>
   getApprovals()
    .then((a) => setApprovalCount(a.length))
    .catch(() => {});
  load();
  const interval = setInterval(load, 30000);
  return () => clearInterval(interval);
 }, []);

 /* Poll inbox count */
 useEffect(() => {
  const load = () =>
   getInbox()
    .then((data) => {
     const c = data?.counts || {};
     setInboxCount((c.approvals || 0) + (c.budget || 0) + (c.tasks || 0) + (c.proposed || 0));
    })
    .catch(() => {});
  load();
  const interval = setInterval(load, 60000);
  return () => clearInterval(interval);
 }, []);

 /* Load projects (re-fetch on navigation) */
 useEffect(() => {
  const load = () =>
   getProjects()
    .then((p) => setProjects(p))
    .catch(() => {});
  load();
  const interval = setInterval(load, 60000);
  return () => clearInterval(interval);
 }, [refreshKey]);

 /* Assign stable colors to projects */
 const coloredProjects = useMemo(
  () =>
   projects.map((p, i) => ({
    ...p,
    color: p.color || PROJECT_COLORS[i % PROJECT_COLORS.length],
   })),
  [projects]
 );

 return (
  <aside className="w-60 h-full min-h-0 border-r border-border bg-background flex flex-col">
   {/* ── Top bar: brand ──────────────────────────────────────── */}
   <div className="flex items-center gap-1 px-3 h-12 shrink-0">
    <div className="w-4 h-4 rounded-sm shrink-0 ml-1 bg-red-500/80" />
    <span className="flex-1 text-sm font-bold text-foreground truncate pl-1">
     Mission Control
    </span>
   </div>

   {/* ── Scrollable nav ───────────────────────────────────────── */}
   <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-4 px-3 py-2">
    {/* Top actions + navigation (no section label, like Paperclip) */}
    <div className="flex flex-col gap-0.5">
     <SidebarNavItem
      active={page ==="overview"}
      onClick={() => navigate("overview")}
      icon={LayoutDashboard}
      label="Dashboard"
     />
     <SidebarNavItem
      active={page ==="inbox"}
      onClick={() => navigate("inbox")}
      icon={Inbox}
      label="Inbox"
      badge={inboxCount}
      badgeTone="danger"
     />
     <SidebarNavItem
      active={page ==="approvals"}
      onClick={() => navigate("approvals")}
      icon={ShieldCheck}
      label="Approvals"
      badge={approvalCount}
      badgeTone="danger"
     />
     <SidebarNavItem
      active={page ==="activity"}
      onClick={() => navigate("activity")}
      icon={Activity}
      label="Activity"
     />
     <SidebarNavItem
      active={page ==="costs"}
      onClick={() => navigate("costs")}
      icon={DollarSign}
      label="Costs"
     />
    </div>

    {/* ── Projects section ─────────────────────────────────── */}
    <SidebarSection
     label="Projects"
     collapsible
    >
     {coloredProjects.map((project) => {
      const slug = project.id || project.slug;
      const isActive = (page ==="project" || page ==="issue-detail") && selectedProject === slug;
      return (
       <button
        key={slug}
        onClick={() => navigate("project", slug)}
        className={`flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors w-full text-left ${
         isActive
          ?"bg-accent text-foreground"
          :"text-foreground/80 hover:bg-accent/50 hover:text-foreground"
        }`}
       >
        <span
         className="shrink-0 h-3.5 w-3.5 rounded-sm"
         style={{ backgroundColor: project.color }}
        />
        <span className="flex-1 truncate">{project.title || project.id}</span>
       </button>
      );
     })}
     {coloredProjects.length === 0 && (
      <span className="px-3 py-1.5 text-[12px] text-muted-foreground/50 italic">
       No projects yet
      </span>
     )}
    </SidebarSection>

    {/* ── Work section ────────────────────────────────────── */}
    <SidebarSection label="Work">
     <SidebarNavItem
      active={page ==="issues" || page ==="issue-detail"}
      onClick={() => {
       // Navigate to first project's issues tab, or overview if none
       const slug = coloredProjects[0]?.id || coloredProjects[0]?.slug;
       if (slug) navigate("project-tab", { slug, tab:"issues" });
       else navigate("overview");
      }}
      icon={CircleDot}
      label="Issues"
     />
     <SidebarNavItem
      active={page ==="agents" || page ==="agent-detail"}
      onClick={() => navigate("agents")}
      icon={Bot}
      label="Agents"
     />
     <SidebarNavItem
      active={page ==="org-chart"}
      onClick={() => navigate("org-chart")}
      icon={Network}
      label="Org Chart"
     />
     <SidebarNavItem
      active={page ==="workspaces"}
      onClick={() => navigate("workspaces")}
      icon={Terminal}
      label="Workspaces"
     />
    </SidebarSection>
   </nav>

   {/* ── Footer ───────────────────────────────────────────────── */}
   <div className="px-4 py-3 border-t border-border">
    <p className="text-[11px] font-mono text-muted-foreground/60">
     OpenClaw v2026.3.13
    </p>
   </div>
  </aside>
 );
}
