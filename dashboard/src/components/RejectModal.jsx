import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * RejectModal — inline modal for rejection comments.
 * Replaces native prompt() to stay within the dashboard's visual language.
 */
export function RejectModal({ onConfirm, onCancel }) {
  const [comment, setComment] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    onConfirm(comment.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative border border-border bg-background p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-foreground">Reject Approval</h3>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            ref={inputRef}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Reason for rejection..."
            rows={3}
            className="w-full rounded-[6px] bg-secondary border border-border px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground/50 resize-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-shadow"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-[14px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!comment.trim()}
              className="px-3 py-1.5 text-[14px] font-medium bg-destructive text-white hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
