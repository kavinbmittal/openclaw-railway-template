import { useState, useEffect } from "react";
import { getApprovals, resolveApproval } from "../api.js";
import { ShieldCheck, Check, X, Loader2, MessageSquare } from "lucide-react";
import { formatTimeAgo } from "../utils/formatDate.js";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { EmptyState } from "../components/EmptyState.jsx";

export default function Approvals({ navigate }) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function refresh() {
    setLoading(true);
    getApprovals()
      .then(setApprovals)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { refresh(); }, []);

  if (loading && approvals.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-12 flex items-center">
          <h1 className="text-sm font-semibold uppercase tracking-wider">Approvals</h1>
        </div>
        <div className="border border-border p-4">
          <div className="bg-accent/75 h-4 w-48 mb-3" />
          <div className="bg-accent/75 h-4 w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="h-12 flex items-center justify-between">
        <h1 className="text-sm font-semibold uppercase tracking-wider">Approvals</h1>
        <span className="text-xs text-muted-foreground">
          {approvals.length} pending
        </span>
      </div>

      {error && (
        <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {approvals.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          text="No pending approvals"
          sub="Approvals will appear here when agents need your sign-off."
        />
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => (
            <ApprovalCard
              key={approval.id || approval._file}
              approval={approval}
              onResolved={refresh}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalCard({ approval, onResolved, navigate }) {
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [action, setAction] = useState(null); // "approved" | "rejected"
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleResolve(decision) {
    if (decision === "rejected" && !comment.trim()) {
      setAction("rejected");
      setShowComment(true);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await resolveApproval({
        project: approval._project || approval.project,
        id: approval.id,
        decision,
        comment: comment.trim() || null,
        requester: approval.requester,
        gate: approval.gate,
        what: approval.what,
        why: approval.why,
        created: approval.created,
      });
      onResolved();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  const timeAgo = approval.created ? formatTimeAgo(approval.created) : "";

  return (
    <div className="border border-border p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {approval._project ? (
              <button
                onClick={() => navigate("project", approval._project)}
                className="text-sm font-medium text-foreground hover:underline"
              >
                {approval._project}
              </button>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">
                {approval.requester}
              </span>
            )}
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-900/50 text-amber-300">
              {approval.gate}
            </span>
          </div>
          <p className="text-sm text-foreground/80">{approval.what}</p>
          {approval.why && approval._source === "deliverables" ? (
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">View deliverable content</summary>
              <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap border border-border p-3 bg-background max-h-64 overflow-y-auto">
                {approval.why}
              </div>
            </details>
          ) : approval.why ? (
            <p className="text-xs text-muted-foreground mt-1">{approval.why}</p>
          ) : null}
        </div>
        <div className="text-right shrink-0">
          <span className="text-xs text-muted-foreground">{approval.requester}</span>
          {timeAgo && (
            <p className="text-xs text-muted-foreground/60 mt-0.5">{timeAgo}</p>
          )}
        </div>
      </div>

      {/* Comment area */}
      {showComment && (
        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={action === "rejected" ? "Reason for rejection (required)" : "Comment (optional)"}
            rows={2}
            className="w-full px-3 py-2 text-sm bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors resize-none"
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (!showComment) {
              setShowComment(true);
              setAction("approved");
            } else {
              handleResolve("approved");
            }
          }}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-700 text-white rounded-md hover:bg-green-600 transition-colors disabled:opacity-50"
        >
          {submitting && action === "approved" ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Check size={12} />
          )}
          Approve
        </button>
        <button
          onClick={() => handleResolve("rejected")}
          disabled={submitting || (action === "rejected" && !comment.trim())}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-700 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {submitting && action === "rejected" ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <X size={12} />
          )}
          Reject
        </button>
        {!showComment && (
          <button
            onClick={() => setShowComment(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquare size={12} />
            Comment
          </button>
        )}
      </div>
    </div>
  );
}

