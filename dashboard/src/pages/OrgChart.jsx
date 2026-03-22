/**
 * OrgChart Page — visual tree layout of the agent hierarchy.
 */

import { useState, useEffect } from"react";
import { Network } from"lucide-react";
import { getOrgChart } from"../api.js";
import { OrgChartTree } from"../components/OrgChartTree.jsx";
import { EmptyState } from"../components/EmptyState.jsx";
import { Skeleton } from"../components/ui/Skeleton.jsx";

export default function OrgChart({ navigate }) {
 const [nodes, setNodes] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);

 useEffect(() => {
  getOrgChart()
   .then((n) => setNodes(n))
   .catch((e) => setError(e.message))
   .finally(() => setLoading(false));
 }, []);

 const handleNodeClick = (node) => {
  if (node.type ==="human") return;
  // Navigate to agent detail — map node id to workspace dir
  const workspaceId = node.id ==="sam" ?"workspace" : `workspace-${node.id}`;
  navigate?.("agent-detail", workspaceId);
 };

 if (loading) {
  return (
   <div className="max-w-[1400px] mx-auto space-y-6">
    <div className="h-12" />
    <Skeleton className="h-8 w-32" />
    <Skeleton className="h-96 w-full" />
   </div>
  );
 }

 if (error) {
  return (
   <div className="max-w-[1400px] mx-auto space-y-6">
    <div className="h-12 flex items-center">
     <h1 className="text-base font-semibold uppercase tracking-wider">Org Chart</h1>
    </div>
    <div className="text-[14px] text-destructive px-3 py-2 border border-destructive/30 bg-destructive/10">
     {error}
    </div>
   </div>
  );
 }

 // Compute summary
 const activeCount = nodes.filter((n) => n.status ==="active").length;
 const totalAgents = nodes.filter((n) => n.type !=="human").length;

 return (
  <div className="max-w-[1400px] mx-auto space-y-6">
   {/* Breadcrumb bar */}
   <div className="h-12 flex items-center justify-between">
    <h1 className="text-base font-semibold uppercase tracking-wider">Org Chart</h1>
    <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
     <span>{totalAgents} agents</span>
     <span className="text-green-400">{activeCount} active</span>
    </div>
   </div>

   {nodes.length === 0 ? (
    <EmptyState
     icon={Network}
     text="No organizational hierarchy found"
     sub="Agent workspaces are used to build the org chart automatically"
    />
   ) : (
    <div className="border border-border bg-muted/10 overflow-x-auto min-h-[400px]">
     <OrgChartTree nodes={nodes} onNodeClick={handleNodeClick} />
    </div>
   )}
  </div>
 );
}
