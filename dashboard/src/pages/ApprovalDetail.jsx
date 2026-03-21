import { useState, useEffect } from "react";
import { Clock, CheckCircle2, XCircle, RotateCcw, Loader2 } from "lucide-react";
import { getApprovalDetail, resolveApproval, requestRevision } from "../api.js";
import { formatTimeAgo } from "../utils/formatDate.js";
import Markdown from "../components/Markdown.jsx";

function StatusBadgeInline({ status }) {
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-900/50 text-green-300">
        <CheckCircle2 size={12} /> Approved
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-900/50 text-red-300">
        <XCircle size={12} /> Rejected
      </span>
    );
  if (status === "revision_requested")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-900/50 text-amber-300">
        <RotateCcw size={12} /> Revision Requested
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-900/50 text-amber-300">
      <Clock size={12} /> Pending
    </span>
  );
}

export default function ApprovalDetail({ approvalId, navigate }) {
  const [approval, setApproval] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resolved, setResolved] = useState(null); // { decision, comment }

  useEffect(() => {
    setLoading(true);
    setError(null);
    getApprovalDetail(approvalId)
      .then(setApproval)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [approvalId]);

  async function handleResolve(decision) {
    if ((decision === "rejected" || decision === "revision_requested") && !comment.trim()) {
      setError(decision === "revision_requested"
        ? "Feedback is required when requesting a revision."
        : "A note is required when rejecting.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (decision === "revision_requested") {
        await requestRevision({
          project: approval._project || approval.project,
          id: approval.id,
          feedback: comment.trim(),
          requester: approval.requester,
          gate: approval.gate,
          what: approval.what || approval.title,
          why: approval.why,
          created: approval.created,
        });
      } else {
        await resolveApproval({
          project: approval._project || approval.project,
          id: approval.id,
          decision,
          comment: comment.trim() || null,
          requester: approval.requester,
          gate: approval.gate,
          what: approval.what || approval.title,
          why: approval.why,
          created: approval.created,
        });
      }
      setResolved({ decision, comment: comment.trim() || null });
      // Refresh approval data
      const updated = await getApprovalDetail(approvalId).catch(() => null);
      if (updated) setApproval(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 p-4">
        <div className="bg-accent/75 h-6 w-48 rounded" />
        <div className="bg-accent/75 h-4 w-32 rounded" />
        <div className="bg-accent/75 h-32 w-full rounded" />
      </div>
    );
  }

  if (!approval) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <p className="text-sm text-muted-foreground">
          {error || "Approval not found."}
        </p>
      </div>
    );
  }

  const projectName = approval._project || approval.project;
  const title = approval.what || approval.title || "";
  const status = resolved ? resolved.decision : (approval.status || "pending");
  const isPending = status === "pending";
  const isRevisionRequested = status === "revision_requested";
  const isDeliverable =
    approval._source === "deliverables" ||
    approval.gate === "deliverable" ||
    approval.gate === "deliverable-review";
  const isExperiment = approval.gate === "experiment-start" || approval.gate === "autoresearch-start";

  const timeAgo = approval.created
    ? formatTimeAgo(approval.created)
    : approval.timestamp
      ? formatTimeAgo(approval.timestamp)
      : "";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="h-12 flex items-center gap-2">
        <button
          onClick={() => navigate("overview")}
          className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Overview
        </button>
        <span className="text-muted-foreground/40">/</span>
        <button
          onClick={() => navigate("approvals")}
          className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Approvals
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-[13px] font-semibold text-foreground truncate">
          {title}
        </span>
      </div>

      {/* Success banner after resolution */}
      {resolved && (
        <div
          className={`border rounded-lg px-4 py-3 ${
            resolved.decision === "approved"
              ? "border-green-700/40 bg-green-900/20"
              : resolved.decision === "revision_requested"
                ? "border-amber-700/40 bg-amber-900/20"
                : "border-red-700/40 bg-red-900/20"
          }`}
        >
          <div className="flex items-center gap-2">
            {resolved.decision === "approved" ? (
              <CheckCircle2 size={16} className="text-green-300" />
            ) : resolved.decision === "revision_requested" ? (
              <RotateCcw size={16} className="text-amber-300" />
            ) : (
              <XCircle size={16} className="text-red-300" />
            )}
            <p
              className={`text-sm font-medium ${
                resolved.decision === "approved"
                  ? "text-green-100"
                  : resolved.decision === "revision_requested"
                    ? "text-amber-100"
                    : "text-red-100"
              }`}
            >
              {resolved.decision === "approved"
                ? "Approved"
                : resolved.decision === "revision_requested"
                  ? "Revision Requested"
                  : "Rejected"}
              {resolved.comment && (
                <span className="font-normal text-xs ml-2 opacity-80">
                  — {resolved.comment}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        {/* Gate + Status + Title */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {approval.gate && (
              <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-amber-900/50 text-amber-300">
                {approval.gate}
              </span>
            )}
            <StatusBadgeInline status={status} />
          </div>
        </div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {projectName && (
            <span>
              Project:{" "}
              <button
                onClick={() => navigate("project", projectName)}
                className="text-primary hover:underline"
              >
                {projectName}
              </button>
            </span>
          )}
          {approval.requester && (
            <span>
              Requested by{" "}
              <button
                className="hover:underline hover:text-foreground transition-colors"
                onClick={() => {
                  const name = (approval.requester || "").toLowerCase();
                  const workspaceId =
                    name === "sam" ? "workspace" : `workspace-${name}`;
                  navigate("agent-detail", workspaceId);
                }}
              >
                {approval.requester}
              </button>
            </span>
          )}
          {timeAgo && <span>{timeAgo}</span>}
        </div>
      </div>

      {/* Why / Body — for experiments, this is the agent's case */}
      {approval.why && !isDeliverable && (
        <div className="border border-border rounded-lg p-6">
          <h3 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-3">
            {isExperiment ? "Approval Request" : "Details"}
          </h3>
          <div className="mc-prose">
            <Markdown content={approval.why} className="text-sm" />
          </div>
        </div>
      )}

      {/* Experiment Plan — rendered from program.md (single source of truth) */}
      {isExperiment && approval.programMd && (
        <div className="border border-border rounded-lg p-6">
          <h3 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-3">
            Experiment Plan
          </h3>
          <div className="border border-border/60 rounded p-4 bg-background max-h-[calc(100vh-400px)] overflow-y-auto mc-prose">
            <Markdown content={approval.programMd} className="text-sm" />
          </div>
        </div>
      )}

      {/* Deliverable content */}
      {isDeliverable && approval.why && (
        <div className="border border-border rounded-lg p-6">
          <h3 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-3">
            Deliverable
          </h3>
          <div className="border border-border/60 rounded p-4 bg-background max-h-[calc(100vh-400px)] overflow-y-auto mc-prose">
            <Markdown content={approval.why} className="text-sm" />
          </div>
        </div>
      )}

      {/* Decision note / Actions */}
      {isPending && !resolved && (
        <div className="border border-border rounded-lg p-6 space-y-4">
          <h3 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Decision
          </h3>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Decision note (required for rejections and revisions)"
            rows={3}
            className="w-full px-3 py-2 text-sm bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors resize-none rounded"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleResolve("approved")}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              Approve
            </button>
            <button
              onClick={() => handleResolve("revision_requested")}
              disabled={submitting || !comment.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RotateCcw size={14} />
              )}
              Request Revision
            </button>
            <button
              onClick={() => handleResolve("rejected")}
              disabled={submitting || !comment.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <XCircle size={14} />
              )}
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Already resolved info */}
      {!isPending && !isRevisionRequested && !resolved && (
        <div className="border border-border rounded-lg p-6">
          <div className="flex items-center gap-2">
            {status === "approved" ? (
              <CheckCircle2 size={16} className="text-green-400" />
            ) : (
              <XCircle size={16} className="text-red-400" />
            )}
            <span className="text-sm font-medium capitalize">{status}</span>
            {approval.resolved_at && (
              <span className="text-xs text-muted-foreground ml-2">
                {formatTimeAgo(approval.resolved_at)}
              </span>
            )}
          </div>
          {approval.comment && (
            <p className="text-sm text-muted-foreground mt-2">
              Note: {approval.comment}
            </p>
          )}
        </div>
      )}

      {/* Revision requested — waiting on agent */}
      {isRevisionRequested && !resolved && (
        <div className="border border-amber-700/40 rounded-lg p-6 bg-amber-900/10">
          <div className="flex items-center gap-2">
            <RotateCcw size={16} className="text-amber-400" />
            <span className="text-sm font-medium text-amber-200">Revision Requested</span>
            {approval.revision_requested_at && (
              <span className="text-xs text-muted-foreground ml-2">
                {formatTimeAgo(approval.revision_requested_at)}
              </span>
            )}
          </div>
          {approval.revision_feedback && (
            <p className="text-sm text-muted-foreground mt-2">
              Feedback: {approval.revision_feedback}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Waiting for {approval.requester || "agent"} to resubmit.
          </p>
        </div>
      )}
    </div>
  );
}
