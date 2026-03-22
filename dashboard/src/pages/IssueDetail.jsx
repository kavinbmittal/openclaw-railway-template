/**
 * IssueDetail — full issue view with two-panel layout.
 * UI ported from Aura HTML reference.
 */
import { useState, useEffect, useCallback } from"react";
import { getIssue, updateIssue, addComment } from"../api.js";
import { Pencil, Trash2 } from"lucide-react";
import { formatDate as formatDateUtil, formatTimeAgo } from"../utils/formatDate.js";
import { Skeleton } from"../components/ui/Skeleton.jsx";
import Markdown from"../components/Markdown.jsx";
import { StatusSelect } from"../components/StatusSelect.jsx";
import { PrioritySelect } from"../components/PrioritySelect.jsx";
import { AssigneeSelect } from"../components/AssigneeSelect.jsx";
import { StatusBadge } from"../components/StatusBadge.jsx";

function formatDate(iso) {
 if (!iso) return"";
 return formatDateUtil(iso);
}

function timeAgo(iso) {
 if (!iso) return"";
 return formatTimeAgo(iso);
}

/* Priority badge — Aura bordered pill */
function PriorityBadge({ priority }) {
 const map = {
  critical:"border-red-500/20 bg-red-500/10 text-red-400",
  high:"border-orange-500/20 bg-orange-500/10 text-orange-400",
  medium:"border-blue-500/20 bg-blue-500/10 text-blue-400",
  low:"border-zinc-700/50 bg-zinc-800/50 text-muted-foreground",
 };
 const cls = map[priority] || map.low;
 return (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium ${cls}`}>
   {(priority ||"none").charAt(0).toUpperCase() + (priority ||"none").slice(1)}
  </span>
 );
}

export default function IssueDetail({ projectSlug, issueId, navigate }) {
 const [issue, setIssue] = useState(null);
 const [loading, setLoading] = useState(true);
 const [editingTitle, setEditingTitle] = useState(false);
 const [titleDraft, setTitleDraft] = useState("");
 const [commentText, setCommentText] = useState("");
 const [submittingComment, setSubmittingComment] = useState(false);

 useEffect(() => {
  setLoading(true);
  getIssue(issueId, projectSlug)
   .then((data) => {
    setIssue(data);
    setTitleDraft(data.title ||"");
   })
   .catch((err) => console.error("Failed to load issue:", err))
   .finally(() => setLoading(false));
 }, [issueId, projectSlug]);

 const handleUpdate = useCallback(
  async (updates) => {
   try {
    const updated = await updateIssue(issueId, projectSlug, updates);
    setIssue(updated);
   } catch (err) {
    console.error("Failed to update issue:", err);
   }
  },
  [issueId, projectSlug]
 );

 const handleAddComment = useCallback(
  async () => {
   if (!commentText.trim()) return;
   setSubmittingComment(true);
   try {
    const result = await addComment(issueId, projectSlug, commentText.trim(),"kavin");
    setIssue(result.issue);
    setCommentText("");
   } catch (err) {
    console.error("Failed to add comment:", err);
   } finally {
    setSubmittingComment(false);
   }
  },
  [issueId, projectSlug, commentText]
 );

 function handleTitleBlur() {
  setEditingTitle(false);
  if (titleDraft.trim() && titleDraft !== issue?.title) {
   handleUpdate({ title: titleDraft.trim() });
  }
 }

 function handleTitleKeyDown(e) {
  if (e.key ==="Enter") { e.preventDefault(); e.target.blur(); }
  if (e.key ==="Escape") { setTitleDraft(issue?.title ||""); setEditingTitle(false); }
 }

 if (loading) {
  return (
   <div className="max-w-[1200px] mx-auto space-y-4">
    <Skeleton className="h-4 w-48" />
    <Skeleton className="h-8 w-96 mb-2" />
    <Skeleton className="h-4 w-64" />
    <Skeleton className="h-64 w-full rounded-[2px] mt-4" />
   </div>
  );
 }

 if (!issue) {
  return (
   <div className="max-w-[1200px] mx-auto">
    <p className="text-[14px] text-muted-foreground">Issue not found</p>
   </div>
  );
 }

 const comments = issue.comments || [];

 return (
  <div className="max-w-[1200px] mx-auto">
   {/* Breadcrumb — Aura: nav text-sm text-zinc-400 with › separators */}
   <nav className="flex items-center text-[13px] text-muted-foreground space-x-2 mb-6">
    <button onClick={() => navigate("overview")} className="hover:text-foreground transition-colors">Projects</button>
    <span className="text-muted-foreground/30">›</span>
    <button onClick={() => navigate("project", projectSlug)} className="hover:text-foreground transition-colors capitalize">{projectSlug}</button>
    <span className="text-muted-foreground/30">›</span>
    <button onClick={() => navigate("project-tab", { slug: projectSlug, tab:"issues" })} className="hover:text-foreground transition-colors">Issues</button>
    <span className="text-muted-foreground/30">›</span>
    <span className="text-foreground font-medium">{issue.id}</span>
   </nav>

   {/* Page Header — Aura: text-3xl font-medium tracking-tight */}
   <div className="mb-10">
    {editingTitle ? (
     <input
      type="text"
      value={titleDraft}
      onChange={(e) => setTitleDraft(e.target.value)}
      onBlur={handleTitleBlur}
      onKeyDown={handleTitleKeyDown}
      className="w-full bg-transparent text-3xl font-medium text-foreground leading-none tracking-tight outline-none border-b border-border pb-1"
      autoFocus
     />
    ) : (
     <h1
      className="text-3xl font-medium text-foreground leading-none tracking-tight mb-4 cursor-text hover:text-foreground/80 transition-colors"
      onClick={() => setEditingTitle(true)}
     >
      {issue.title}
     </h1>
    )}

    {/* Metadata line — Aura: flex items-center gap-3 with dot separators */}
    <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
     <span className="font-mono">{issue.id}</span>
     <span className="text-muted-foreground/30">·</span>
     <StatusBadge status={issue.status} />
     {issue.priority && issue.priority !== "none" && (
      <>
       <span className="text-muted-foreground/30">·</span>
       <PriorityBadge priority={issue.priority} />
      </>
     )}
     {issue.assignee && (
      <>
       <span className="text-muted-foreground/30">·</span>
       <span className="text-foreground/80 capitalize">{issue.assignee}</span>
      </>
     )}
    </div>
   </div>

   {/* Two-column layout — Aura: grid-cols-3 */}
   <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
    {/* Left Column — 2/3 */}
    <div className="xl:col-span-2 space-y-6">
     {/* Description Card — Aura card */}
     <div className="bg-card border border-border rounded-[2px] shadow-sm">
      <div className="p-5 border-b border-border">
       <h2 className="text-[14px] font-medium text-foreground">Description</h2>
      </div>
      <div className="p-5 text-[14px] text-foreground/80 leading-relaxed">
       {issue.description ? (
        <Markdown content={issue.description} />
       ) : (
        <p className="text-muted-foreground/50 italic">No description provided.</p>
       )}
      </div>
     </div>

     {/* Labels */}
     {issue.labels && issue.labels.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
       {issue.labels.map((label, i) => (
        <span key={i} className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium border border-border bg-secondary text-foreground/80">
         {label}
        </span>
       ))}
      </div>
     )}

     {/* Comments Card — Aura card with divide-y */}
     <div className="bg-card border border-border rounded-[2px] shadow-sm">
      <div className="p-5 border-b border-border flex items-center gap-2">
       <h2 className="text-[14px] font-medium text-foreground">Comments</h2>
       {comments.length > 0 && (
        <span className="px-1.5 py-0.5 rounded-[2px] bg-secondary text-[12px] text-muted-foreground font-mono">{comments.length}</span>
       )}
      </div>

      {comments.length > 0 && (
       <div className="divide-y divide-border/50">
        {comments.map((c, i) => (
         <div key={i} className="px-5 py-5">
          <div className="flex justify-between items-center mb-2">
           <span className="text-[14px] font-medium text-foreground capitalize">{c.author ||"system"}</span>
           <span className="text-[12px] font-mono text-muted-foreground">{timeAgo(c.timestamp)}</span>
          </div>
          <div className="text-[14px] text-foreground/80 mc-prose">
           <Markdown content={c.text || c.body ||""} />
          </div>
         </div>
        ))}
       </div>
      )}

      {/* Add comment area — Aura: bg-zinc-900/30 border-t */}
      <div className="p-5 bg-secondary/30 border-t border-border">
       <textarea
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        className="w-full rounded-[2px] border border-border bg-background text-[14px] text-foreground p-3 placeholder:text-muted-foreground/40 focus:outline-none focus:border-ring/50 focus:ring-1 focus:ring-ring/50 transition-all resize-y min-h-[100px]"
        placeholder="Leave a comment or instruction for the agents..."
       />
       <div className="flex justify-between items-center mt-3">
        <div className="text-[12px] text-muted-foreground">Markdown is supported</div>
        <button
         onClick={handleAddComment}
         disabled={submittingComment || !commentText.trim()}
         className="px-4 py-1.5 rounded-[6px] border border-border bg-secondary text-[13px] font-medium text-foreground hover:bg-accent transition-colors shadow-sm disabled:opacity-50"
        >
         Add Comment
        </button>
       </div>
      </div>
     </div>
    </div>

    {/* Right Column — 1/3 */}
    <div className="xl:col-span-1 space-y-6">
     {/* Details Card — Aura: p-5 space-y-5 with flex-col gap-1.5 */}
     <div className="bg-card border border-border rounded-[2px] shadow-sm">
      <div className="p-5 space-y-5">
       <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground">Status</label>
        <StatusSelect
         value={issue.status}
         onChange={(status) => handleUpdate({ status })}
        />
       </div>

       <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground">Priority</label>
        <PrioritySelect
         value={issue.priority}
         onChange={(priority) => handleUpdate({ priority })}
        />
       </div>

       <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground">Assignee</label>
        <AssigneeSelect
         value={issue.assignee}
         onChange={(assignee) => handleUpdate({ assignee })}
        />
       </div>

       <div className="pt-4 border-t border-border/50 space-y-4">
        <div className="flex flex-col gap-1">
         <label className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground">Project</label>
         <span
          className="text-[14px] text-foreground hover:underline cursor-pointer capitalize"
          onClick={() => navigate("project", projectSlug)}
         >
          {projectSlug}
         </span>
        </div>

        <div className="flex flex-col gap-1">
         <label className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground">Created</label>
         <span className="text-[14px] text-foreground">{formatDate(issue.created)}</span>
        </div>

        <div className="flex flex-col gap-1">
         <label className="text-[11px] uppercase font-mono tracking-[0.15em] text-muted-foreground">Updated</label>
         <span className="text-[14px] text-foreground">{timeAgo(issue.updated)}</span>
        </div>
       </div>
      </div>
     </div>

     {/* Actions Card — Aura: p-4 with edit + delete buttons */}
     <div className="bg-card border border-border rounded-[2px] shadow-sm p-4">
      <button
       onClick={() => setEditingTitle(true)}
       className="w-full py-2 rounded-[6px] border border-border bg-secondary text-[13px] font-medium text-foreground hover:bg-accent transition-colors flex items-center justify-center gap-2 shadow-sm"
      >
       <Pencil size={14} />
       Edit Issue
      </button>
     </div>
    </div>
   </div>
  </div>
 );
}
