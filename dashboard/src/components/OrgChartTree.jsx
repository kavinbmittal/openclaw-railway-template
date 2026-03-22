/**
 * OrgChartTree — recursive tree layout with connecting lines via CSS borders.
 * Uses flexbox for layout, no SVG needed.
 */

import { OrgChartNode } from"./OrgChartNode.jsx";

function TreeNode({ node, nodeMap, onNodeClick, isLast = false }) {
 const children = (node.children || [])
  .map((id) => nodeMap[id])
  .filter(Boolean);

 return (
  <div className="flex flex-col items-center">
   {/* The node card */}
   <OrgChartNode
    node={node}
    onClick={() => onNodeClick?.(node)}
   />

   {/* Connector + children */}
   {children.length > 0 && (
    <>
     {/* Vertical line down from parent */}
     <div className="w-px h-6 bg-border" />

     {/* Horizontal line spanning all children */}
     <div className="flex items-start">
      {children.map((child, i) => {
       const isFirst = i === 0;
       const isChildLast = i === children.length - 1;
       const isOnly = children.length === 1;

       return (
        <div key={child.id} className="flex flex-col items-center">
         {/* Horizontal connector segment */}
         <div
          className={`h-px self-stretch ${
           isOnly
            ?"bg-transparent"
            : isFirst
            ?"bg-border [clip-path:inset(0_0_0_50%)]"
            : isChildLast
            ?"bg-border [clip-path:inset(0_50%_0_0)]"
            :"bg-border"
          }`}
         />
         {/* Vertical line down to child */}
         <div className="w-px h-6 bg-border" />
         {/* Recurse */}
         <div className="px-3">
          <TreeNode
           node={child}
           nodeMap={nodeMap}
           onNodeClick={onNodeClick}
           isLast={isChildLast}
          />
         </div>
        </div>
       );
      })}
     </div>
    </>
   )}
  </div>
 );
}

export function OrgChartTree({ nodes, onNodeClick }) {
 // Build lookup map
 const nodeMap = {};
 for (const n of nodes) {
  nodeMap[n.id] = n;
 }

 // Find roots (nodes that no other node lists as a child)
 const childIds = new Set();
 for (const n of nodes) {
  for (const cid of n.children || []) {
   childIds.add(cid);
  }
 }
 const roots = nodes.filter((n) => !childIds.has(n.id));

 if (roots.length === 0 && nodes.length > 0) {
  // Fallback: use the first node
  roots.push(nodes[0]);
 }

 return (
  <div className="flex justify-center overflow-x-auto py-6 px-4">
   <div className="flex items-start gap-8">
    {roots.map((root) => (
     <TreeNode
      key={root.id}
      node={root}
      nodeMap={nodeMap}
      onNodeClick={onNodeClick}
     />
    ))}
   </div>
  </div>
 );
}
