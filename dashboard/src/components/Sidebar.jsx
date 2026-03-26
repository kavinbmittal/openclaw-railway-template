import { useState, useEffect, useMemo } from"react";
import {
 LayoutDashboard,
 ShieldCheck,
 ChevronRight,
 Bot,
 Zap,
 Activity,
 CircleDot,
 DollarSign,
 Network,
 Terminal,
 Plus,
 Cpu,
} from"lucide-react";
import { getApprovals, getProjects, getInbox } from"../api.js";

/* ── Project dot colors — cycle through distinct colors ─────────────── */
const PROJECT_DOT_COLORS = [
 "#10b981", // emerald-500
 "#6366f1", // indigo-500
 "#f59e0b", // amber-500
 "#06b6d4", // cyan-500
 "#f43f5e", // rose-500
 "#3b82f6", // blue-500
 "#a855f7", // purple-500
 "#14b8a6", // teal-500
];

/* ── Section header (Paperclip style) ──────────────────────────────── */
function SidebarSection({ label, children, collapsible = false, defaultOpen = true, action }) {
 const [open, setOpen] = useState(defaultOpen);

 return (
  <div>
   <div className="group flex items-center mb-2 px-2">
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
      <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
       {label}
      </span>
     </button>
    ) : (
     <span className="flex-1 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
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
   className={`flex items-center gap-2.5 px-2 py-1.5 rounded-[6px] text-[15px] font-medium transition-[color,box-shadow] w-full text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
    active
     ?"bg-accent/60 text-foreground"
     :"text-muted-foreground hover:bg-accent/40 hover:text-foreground"
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
     className={`ml-auto rounded-full px-1.5 py-0.5 text-[12px] leading-none ${
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
     // Badge = Sections 1+2 only (Decisions + Risks). Excludes standups and experiment updates.
     setInboxCount((c.approvals || 0) + (c.proposed || 0) + (c.budget || 0) + (c.blocked || 0) + (c.tasks || 0) + (c.overdue || 0) + (c.paused || 0));
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
    color: PROJECT_DOT_COLORS[i % PROJECT_DOT_COLORS.length],
   })),
  [projects]
 );

 return (
  <aside className="w-60 h-full min-h-0 border-r border-border bg-background flex flex-col">
   {/* ── Top bar: brand ──────────────────────────────────────── */}
   <div className="flex items-center gap-2 px-5 h-[60px] shrink-0 border-b border-border">
    <div className="w-6 h-6 rounded-[6px] shrink-0 bg-red-500/80 flex items-center justify-center">
     <span className="text-white text-[11px] font-bold">MC</span>
    </div>
    <span className="flex-1 text-[14px] font-semibold text-foreground truncate tracking-wide">
     Mission Control
    </span>
   </div>

   {/* ── Scrollable nav ───────────────────────────────────────── */}
   <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide p-4 space-y-6">
    {/* Top actions + navigation (no section label, like Paperclip) */}
    <div className="flex flex-col gap-0.5">
     <SidebarNavItem
      active={page ==="overview"}
      onClick={() => navigate("overview")}
      icon={LayoutDashboard}
      label="Dashboard"
     />
     <SidebarNavItem
      active={page ==="briefing"}
      onClick={() => navigate("briefing")}
      icon={Zap}
      label="Briefing"
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
     action={
      <button
       onClick={() => navigate("create-project")}
       className="p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
       title="New project"
      >
       <Plus size={14} />
      </button>
     }
    >
     {coloredProjects.map((project) => {
      const slug = project.id || project.slug;
      const isActive = (page ==="project" || page ==="issue-detail") && selectedProject === slug;
      return (
       <button
        key={slug}
        onClick={() => navigate("project", slug)}
        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-[6px] text-[15px] font-medium transition-[color,box-shadow] w-full text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
         isActive
          ?"bg-accent/60 text-foreground"
          :"text-muted-foreground hover:bg-accent/40 hover:text-foreground"
        }`}
       >
        <span
         className="shrink-0 w-1.5 h-1.5 rounded-[2px] bg-zinc-500"
         style={project.color ? { backgroundColor: project.color } : undefined}
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
     <SidebarNavItem
      active={page ==="model-routing"}
      onClick={() => navigate("model-routing")}
      icon={Cpu}
      label="Model Routing"
     />
    </SidebarSection>
   </nav>

   {/* ── Footer ───────────────────────────────────────────────── */}
   <div className="p-4 border-t border-border">
    <div className="flex items-center gap-3 px-2 py-1.5 rounded-[6px] hover:bg-accent/40 transition-colors cursor-default">
     <div className="w-8 h-8 rounded-[6px] bg-secondary border border-border flex items-center justify-center text-[12px] font-semibold text-muted-foreground shrink-0">
      KM
     </div>
     <div className="flex-1 overflow-hidden">
      <div className="text-[15px] font-medium text-foreground truncate">Kavin</div>
      <div className="text-[11px] text-muted-foreground truncate">OpenClaw v2026.3.13</div>
     </div>
    </div>
   </div>
  </aside>
 );
}
