/**
 * CommentThread — list of comments with author, timestamp, text.
 * Adapted from Paperclip's CommentThread.
 */
import { useState } from"react";
import { AgentInitial } from"./AssigneeSelect.jsx";
import Markdown from"./Markdown.jsx";
import { formatDateTime } from"../utils/formatDate.js";

function formatTime(iso) {
 if (!iso) return"";
 return formatDateTime(iso);
}

export function CommentThread({ comments = [], onAdd, className ="" }) {
 const [body, setBody] = useState("");
 const [submitting, setSubmitting] = useState(false);

 async function handleSubmit() {
  const trimmed = body.trim();
  if (!trimmed || !onAdd) return;
  setSubmitting(true);
  try {
   await onAdd(trimmed);
   setBody("");
  } finally {
   setSubmitting(false);
  }
 }

 function handleKeyDown(e) {
  if (e.key ==="Enter" && (e.metaKey || e.ctrlKey)) {
   e.preventDefault();
   handleSubmit();
  }
 }

 return (
  <div className={`space-y-4 ${className}`}>
   <h3 className="text-sm font-semibold">
    Comments ({comments.length})
   </h3>

   {comments.length === 0 ? (
    <p className="text-sm text-muted-foreground">No comments yet.</p>
   ) : (
    <div className="space-y-3">
     {comments.map((comment, i) => (
      <div
       key={i}
       className="border border-border p-3"
      >
       <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
         <AgentInitial name={comment.author ||"?"} />
         <span className="text-sm font-medium capitalize">
          {comment.author ||"Unknown"}
         </span>
        </div>
        <span className="text-xs text-muted-foreground">
         {formatTime(comment.created)}
        </span>
       </div>
       <Markdown content={comment.text} className="text-sm" />
      </div>
     ))}
    </div>
   )}

   {onAdd && (
    <div className="space-y-2">
     <textarea
      value={body}
      onChange={(e) => setBody(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Leave a comment..."
      className="w-full min-h-[80px] rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 resize-y"
     />
     <div className="flex items-center justify-end gap-2">
      <span className="text-[11px] text-muted-foreground/50 mr-auto">
       Cmd+Enter to submit
      </span>
      <button
       disabled={!body.trim() || submitting}
       onClick={handleSubmit}
       className="inline-flex items-center px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
       {submitting ?"Posting..." :"Comment"}
      </button>
     </div>
    </div>
   )}
  </div>
 );
}
