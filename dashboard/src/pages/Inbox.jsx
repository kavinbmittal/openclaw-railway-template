import { useState, useEffect, useMemo } from"react";
import { getInbox, resolveApproval } from"../api.js";
import { Inbox as InboxIcon, CheckCircle } from"lucide-react";
import { Tabs, TabsList, TabsTrigger } from"../components/ui/Tabs.jsx";
import { Skeleton } from"../components/ui/Skeleton.jsx";
import { EmptyState } from"../components/EmptyState.jsx";
import { InboxItem } from"../components/InboxItem.jsx";
import ApprovalCard from "../components/ApprovalCard.jsx";
import { RejectModal } from "../components/RejectModal.jsx";

const TABS = [
 { value:"all", label:"All" },
 { value:"proposed_issue", label:"Proposed" },
 { value:"approval", label:"Approvals" },
 { value:"budget", label:"Budget" },
 { value:"stale_task", label:"Tasks" },
 { value:"standup", label:"Standups" },
];

export default function Inbox({ navigate }) {
 const [data, setData] = useState(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [tab, setTab] = useState("all");
 const [actionError, setActionError] = useState(null);
 const [rejectingApproval, setRejectingApproval] = useState(null);

 function refresh() {
  setLoading(true);
  getInbox()
   .then(setData)
   .catch((e) => setError(e.message))
   .finally(() => setLoading(false));
 }

 useEffect(() => {
  refresh();
 }, []);

 const items = useMemo(() => {
  if (!data?.items) return [];
  if (tab ==="all") return data.items;
  return data.items.filter((item) => item.type === tab);
 }, [data, tab]);

 const tabCounts = useMemo(() => {
  if (!data?.counts) return {};
  return data.counts;
 }, [data]);

 async function handleApprove(approval) {
  setActionError(null);
  try {
   await resolveApproval({
    project: approval._project || approval.project,
    id: approval.id,
    decision:"approved",
    comment: null,
    requester: approval.requester,
    gate: approval.gate,
    what: approval.what || approval.title,
    why: approval.why,
    created: approval.created || approval.timestamp,
   });
   refresh();
  } catch (err) {
   setActionError(err.message);
  }
 }

 function handleReject(approval) {
  setRejectingApproval(approval);
 }

 async function confirmReject(comment) {
  const approval = rejectingApproval;
  setRejectingApproval(null);
  setActionError(null);
  try {
   await resolveApproval({
    project: approval._project || approval.project,
    id: approval.id,
    decision: "rejected",
    comment,
    requester: approval.requester,
    gate: approval.gate,
    what: approval.what || approval.title,
    why: approval.why,
    created: approval.created || approval.timestamp,
   });
   refresh();
  } catch (err) {
   setActionError(err.message);
  }
 }

 if (loading && !data) {
  return (
   <div className="space-y-6">
    <div className="h-12 flex items-center">
     <h1 className="text-base font-semibold uppercase tracking-wider">Inbox</h1>
    </div>
    <div className="space-y-2">
     {[1, 2, 3].map((i) => (
      <div key={i} className="bg-card/50 rounded-sm border border-border p-4">
       <Skeleton className="h-4 w-64 mb-2" />
       <Skeleton className="h-3 w-40" />
      </div>
     ))}
    </div>
   </div>
  );
 }

 return (
  <div className="space-y-6">
   {/* Header */}
   <div className="h-12 flex items-center justify-between">
    <h1 className="text-base font-semibold uppercase tracking-wider">Inbox</h1>
    <span className="text-xs text-muted-foreground">
     {data?.counts?.total || 0} items
    </span>
   </div>

   {/* Tabs */}
   <Tabs value={tab} onValueChange={setTab}>
    <TabsList>
     {TABS.map((t) => {
      const count =
       t.value ==="all"
        ? tabCounts.total || 0
        : tabCounts[t.value ==="stale_task" ?"tasks" : t.value] || 0;
      return (
       <TabsTrigger key={t.value} value={t.value}>
        {t.label}
        {count > 0 && (
         <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-muted text-muted-foreground text-[11px] font-medium px-1">
          {count}
         </span>
        )}
       </TabsTrigger>
      );
     })}
    </TabsList>
   </Tabs>

   {/* Errors */}
   {error && (
    <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
     {error}
    </div>
   )}
   {actionError && (
    <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
     {actionError}
    </div>
   )}

   {/* Items */}
   {items.length === 0 ? (
    <EmptyState
     icon={tab ==="all" ? CheckCircle : InboxIcon}
     text={tab ==="all" ?"All clear" : `No ${TABS.find((t) => t.value === tab)?.label?.toLowerCase() ||"items"}`}
     sub={tab ==="all" ?"Nothing needs your attention right now." : undefined}
    />
   ) : (
    <div className="border border-border overflow-hidden">
     {items.map((item) =>
      item.type ==="approval" ? (
       <ApprovalCard
        key={item.id}
        approval={{
         ...item.data,
         id: item.id,
         _project: item.project,
         project: item.project,
         requester: item.requester || item.data?.requester,
         gate: item.gate || item.data?.gate,
         what: item.data?.what || item.title,
         why: item.data?.why,
         created: item.data?.created || item.timestamp,
         timestamp: item.timestamp,
         title: item.title,
         subtitle: item.subtitle,
         _source: item.data?._source,
        }}
        onApprove={handleApprove}
        onReject={handleReject}
        navigate={navigate}
        hideProject={false}
       />
      ) : (
       <InboxItem
        key={item.id}
        item={item}
        onNavigate={navigate}
       />
      )
     )}
    </div>
   )}
   {rejectingApproval && (
    <RejectModal
     onConfirm={confirmReject}
     onCancel={() => setRejectingApproval(null)}
    />
   )}
  </div>
 );
}
