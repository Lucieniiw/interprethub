import { useEffect } from "react";
import { Link } from "react-router";
import type { ExportableAssignment } from "../assignmentExport";
import { AssignmentCard } from "./AssignmentCard";
import styles from "./CalendarAssignmentModal.module.css";

export type CalendarAssignmentModalProps = {
  job: ExportableAssignment | null;
  onClose: () => void;
};

export function CalendarAssignmentModal({ job, onClose }: CalendarAssignmentModalProps) {
  useEffect(() => {
    if (!job) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [job, onClose]);

  if (!job) return null;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cal-assignment-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.panel}>
        <div className={styles.head}>
          <h2 id="cal-assignment-title" className={styles.title}>
            Assignment
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={styles.body}>
          <AssignmentCard job={job} />
        </div>
        <div className={styles.footer}>
          <Link to={`/jobs/${job.id}`} className={styles.openFull} onClick={onClose}>
            Open full page
          </Link>
          <button type="button" className={styles.closeSecondary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
