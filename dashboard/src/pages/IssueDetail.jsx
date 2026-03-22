/**
 * IssueDetail — full issue view with two-panel layout.
 * Left: title, description, comments. Right: metadata sidebar.
 * Adapted from Paperclip's issue detail layout.
 */
import { useState, useEffect, useCallback } from"react";
import { getIssue, updateIssue, addComment } from"../api.js";
import { ArrowLeft, Clock, Calendar } from"lucide-react";
import { formatDate as formatDateUtil, formatTimeAgo } from"../utils/formatDate.js";
import { Skeleton } from"../components/ui/Skeleton.jsx";
import Markdown from"../components/Markdown.jsx";
import { StatusSelect } from"../components/StatusSelect.jsx";
import { PrioritySelect } from"../components/PrioritySelect.jsx";
import { AssigneeSelect } from"../components/AssigneeSelect.jsx";
import { CommentThread } from"../components/CommentThread.jsx";
import { StatusBadge } from"../components/StatusBadge.jsx";

function formatDate(iso) {
 if (!iso) return"";
 return formatDateUtil(iso);
}

function timeAgo(iso) {
 if (!iso) return"";
 return formatTimeAgo(iso);
}

function PropertyRow({ label, children }) {
 return (
  <div className="flex items-center gap-3 py-1.5">
   <span className="text-xs text-muted-foreground shrink-0 w-20">{label}</span>
   <div className="flex items-center gap-1.5 min-w-0 flex-1">{children}</div>
  </div>
 );
}

export default function IssueDetail({ projectSlug, issueId, navigate }) {
 const [issue, setIssue] = useState(null);
 const [loading, setLoading] = useState(true);
 const [editingTitle, setEditingTitle] = useState(false);
 const [titleDraft, setTitleDraft] = useState("");

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
  async (text) => {
   try {
    const result = await addComment(issueId, projectSlug, text,"kavin");
    setIssue(result.issue);
   } catch (err) {
    console.error("Failed to add comment:", err);
   }
  },
  [issueId, projectSlug]
 );

 function handleTitleBlur() {
  setEditingTitle(false);
  if (titleDraft.trim() && titleDraft !== issue?.title) {
   handleUpdate({ title: titleDraft.trim() });
  }
 }

 function handleTitleKeyDown(e) {
  if (e.key ==="Enter") {
   e.preventDefault();
   e.target.blur();
  }
  if (e.key ==="Escape") {
   setTitleDraft(issue?.title ||"");
   setEditingTitle(false);
  }
 }

 if (loading) {
  return (
   <div className="space-y-4 p-4">
    <Skeleton className="h-6 w-48" />
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-32 w-full" />
   </div>
  );
 }

 if (!issue) {
  return (
   <div className="flex items-center justify-center h-64">
    <p className="text-sm text-destructive">Issue not found</p>
   </div>
  );
 }

 return (
  <div className="space-y-6">
   {/* Breadcrumb */}
   <div className="h-12 flex items-center gap-2">
    <button
     onClick={() => navigate("overview")}
     className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
    >
     Dashboard
    </button>
    <span className="text-muted-foreground/40">›</span>
    <button
     onClick={() => navigate("project", projectSlug)}
     className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
    >
     {projectSlug}
    </button>
    <span className="text-muted-foreground/40">›</span>
    <button
     onClick={() => navigate("project-tab", { slug: projectSlug, tab:"issues" })}
     className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
    >
     Issues
    </button>
    <span className="text-muted-foreground/40">›</span>
    <span className="text-[13px] font-semibold text-foreground truncate">
     {issue.id}
    </span>
   </div>

   {/* Two-panel layout */}
   <div className="flex flex-col lg:flex-row gap-6">
    {/* Left panel: title, description, comments */}
    <div className="flex-1 min-w-0 space-y-6">
     {/* Title */}
     <div>
      {editingTitle ? (
       <input
        type="text"
        value={titleDraft}
        onChange={(e) => setTitleDraft(e.target.value)}
        onBlur={handleTitleBlur}
        onKeyDown={handleTitleKeyDown}
        className="w-full bg-transparent text-xl font-semibold outline-none border-b border-border pb-1"
        autoFocus
       />
      ) : (
       <h2
        className="text-xl font-semibold text-foreground cursor-text hover:text-foreground/80 transition-colors"
        onClick={() => setEditingTitle(true)}
       >
        {issue.title}
       </h2>
      )}
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
       <span className="font-mono">{issue.id}</span>
       <StatusBadge status={issue.status} />
      </div>
     </div>

     {/* Description */}
     {issue.description ? (
      <div className="border border-border p-4">
       <Markdown content={issue.description} />
      </div>
     ) : (
      <div className="border border-border border-dashed p-4">
       <p className="text-sm text-muted-foreground/50 italic">No description provided.</p>
      </div>
     )}

     {/* Labels */}
     {issue.labels && issue.labels.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
       {issue.labels.map((label, i) => (
        <span
         key={i}
         className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-accent text-accent-foreground"
        >
         {label}
        </span>
       ))}
      </div>
     )}

     {/* Comments */}
     <CommentThread
      comments={issue.comments || []}
      onAdd={handleAddComment}
     />
    </div>

    {/* Right sidebar: metadata */}
    <div className="lg:w-64 shrink-0 space-y-4">
     <div className="border border-border p-4 space-y-1">
      <PropertyRow label="Status">
       <StatusSelect
        value={issue.status}
        onChange={(status) => handleUpdate({ status })}
       />
      </PropertyRow>

      <PropertyRow label="Priority">
       <PrioritySelect
        value={issue.priority}
        onChange={(priority) => handleUpdate({ priority })}
       />
      </PropertyRow>

      <PropertyRow label="Assignee">
       <AssigneeSelect
        value={issue.assignee}
        onChange={(assignee) => handleUpdate({ assignee })}
       />
      </PropertyRow>

      <div className="border-t border-border my-2" />

      <PropertyRow label="Created by">
       <span className="text-sm capitalize">{issue.created_by ||"kavin"}</span>
      </PropertyRow>

      <PropertyRow label="Created">
       <span className="text-sm">{formatDate(issue.created)}</span>
      </PropertyRow>

      <PropertyRow label="Updated">
       <span className="text-sm">{timeAgo(issue.updated)}</span>
      </PropertyRow>
     </div>
    </div>
   </div>
  </div>
 );
}
