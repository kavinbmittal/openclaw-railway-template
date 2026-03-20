import { useState, useEffect } from "react";
import { LayoutDashboard, Users, ShieldCheck, Plus } from "lucide-react";
import { getApprovals } from "../api.js";

const NAV = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "approvals", label: "Approvals", icon: ShieldCheck, hasBadge: true },
  { id: "agents", label: "Agents", icon: Users },
];

export default function Sidebar({ page, navigate }) {
  const [approvalCount, setApprovalCount] = useState(0);

  useEffect(() => {
    getApprovals()
      .then((a) => setApprovalCount(a.length))
      .catch(() => {});
    const interval = setInterval(() => {
      getApprovals()
        .then((a) => setApprovalCount(a.length))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-60 h-full min-h-0 border-r border-border bg-sidebar flex flex-col">
      <div className="flex items-center gap-2 px-4 h-12 shrink-0 border-b border-border">
        <span className="text-base">🦞</span>
        <span className="text-[13px] font-semibold tracking-wide text-foreground">
          Mission Control
        </span>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-0.5 px-2 py-3">
        <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60">
          Navigation
        </div>
        {NAV.map(({ id, label, icon: Icon, hasBadge }) => (
          <button
            key={id}
            onClick={() => navigate(id)}
            className={`flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors w-full text-left ${
              page === id
                ? "bg-accent text-foreground"
                : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            <Icon size={15} strokeWidth={1.8} />
            {label}
            {hasBadge && approvalCount > 0 && (
              <span className="ml-auto rounded-full px-1.5 py-0.5 text-xs leading-none bg-red-600/90 text-red-50">
                {approvalCount}
              </span>
            )}
          </button>
        ))}

        <div className="px-2 py-1.5 mt-4 text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60">
          Actions
        </div>
        <button
          onClick={() => navigate("create-project")}
          className={`flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors w-full text-left ${
            page === "create-project"
              ? "bg-accent text-foreground"
              : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
          }`}
        >
          <Plus size={15} strokeWidth={1.8} />
          New Project
        </button>
      </nav>

      <div className="px-4 py-3 border-t border-border">
        <p className="text-[10px] font-mono text-muted-foreground/60">
          OpenClaw v2026.3.13
        </p>
      </div>
    </aside>
  );
}
