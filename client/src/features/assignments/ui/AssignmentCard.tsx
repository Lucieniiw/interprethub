import { Link } from "react-router";
import { formatJobReference } from "@interpret-hub/shared";
import type { ExportableAssignment } from "../assignmentExport";
import { printAssignmentInNewWindow } from "../assignmentExport";
import styles from "./AssignmentCard.module.css";

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    OPEN: "Open",
    ASSIGNED: "Assigned",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    PAID: "Paid",
  };
  return map[status] ?? status;
}

function statusClass(status: string): string {
  switch (status) {
    case "OPEN":
      return styles.statusOpen;
    case "ASSIGNED":
      return styles.statusAssigned;
    case "COMPLETED":
      return styles.statusCompleted;
    case "CANCELLED":
      return styles.statusCancelled;
    case "PAID":
      return styles.statusPaid;
    default:
      return styles.statusDefault;
  }
}

function categoryLabel(c: string): string {
  if (c === "INTERPRETATION") return "Interpretation";
  if (c === "TRANSLATION") return "Translation";
  return c;
}

function languageLine(j: ExportableAssignment): string {
  if (j.serviceCategory === "TRANSLATION" && j.targetLanguage) {
    return `${j.language} → ${j.targetLanguage}`;
  }
  return j.language;
}

function completionReviewLabel(status: string | null | undefined): { text: string; className: string } | null {
  if (!status || status === "NONE") return null;
  if (status === "PENDING_REVIEW") {
    return {
      text: "Completion submitted — awaiting coordinator review.",
      className: styles.reviewPending,
    };
  }
  if (status === "APPROVED") {
    return {
      text: "Completion approved by coordinator.",
      className: styles.reviewApproved,
    };
  }
  if (status === "DISPUTED") {
    return {
      text: "Coordinator disputed this submission — open Details to update and resubmit.",
      className: styles.reviewDisputed,
    };
  }
  return null;
}

export type AssignmentCardProps = {
  job: ExportableAssignment;
  variant?: "default" | "open";
  actionId?: number | null;
  onClaim?: (id: number) => void;
  onDecline?: (id: number) => void;
};

export function AssignmentCard({
  job: j,
  variant = "default",
  actionId,
  onClaim,
  onDecline,
}: AssignmentCardProps) {
  const ref = formatJobReference(j);
  const consumer = j.recipientName ?? j.translationClientName;
  const review = completionReviewLabel(j.completionStatus);

  return (
    <article className={styles.card} data-status={j.status}>
      {review ? <p className={`${styles.reviewBanner} ${review.className}`}>{review.text}</p> : null}
      <div className={styles.cardTop}>
        <Link to={`/jobs/${j.id}`} className={styles.refLink}>
          {ref}
        </Link>
        <span className={`${styles.status} ${statusClass(j.status)}`}>{formatStatus(j.status)}</span>
      </div>
      <p className={styles.category}>{categoryLabel(j.serviceCategory)}</p>
      <p className={styles.language}>{languageLine(j)}</p>
      <p className={styles.time}>
        {new Date(j.startTime).toLocaleString()} — {new Date(j.endTime).toLocaleString()}
      </p>
      {j.location ? <p className={styles.meta}>{j.location}</p> : null}
      <dl className={styles.dl}>
        <div>
          <dt>Client</dt>
          <dd>{j.client?.name ?? "—"}</dd>
        </div>
        <div>
          <dt>Interpreter</dt>
          <dd>{j.interpreter?.name ?? "—"}</dd>
        </div>
        {consumer ? (
          <div>
            <dt>Consumer / subject</dt>
            <dd>{consumer}</dd>
          </div>
        ) : null}
      </dl>
      <div className={styles.cardActions}>
        <Link to={`/jobs/${j.id}`} className={styles.detailsBtn}>
          Details
        </Link>
        <button type="button" className={styles.ghostBtn} onClick={() => printAssignmentInNewWindow(j)}>
          Print
        </button>
        {variant === "open" && onClaim && onDecline ? (
          <>
            <button
              type="button"
              className={styles.claimBtn}
              disabled={actionId === j.id}
              onClick={() => onClaim(j.id)}
            >
              {actionId === j.id ? "…" : "Claim"}
            </button>
            <button
              type="button"
              className={styles.declineBtn}
              disabled={actionId === j.id}
              onClick={() => onDecline(j.id)}
            >
              Decline
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}
