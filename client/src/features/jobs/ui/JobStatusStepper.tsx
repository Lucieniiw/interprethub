import styles from "./JobStatusStepper.module.css";

export type JobStepperJob = {
  status: string;
  billingStatus?: string | null;
  interpreterId: number | null;
};

export function JobStatusStepper({ job }: { job: JobStepperJob }) {
  const cancelled = job.status === "CANCELLED";
  const paid = job.status === "PAID" || job.billingStatus === "PAID";
  const wrappedUp = ["COMPLETED", "PAID", "CANCELLED"].includes(job.status);
  const assigned =
    job.interpreterId != null || ["ASSIGNED", "COMPLETED", "PAID", "CANCELLED"].includes(job.status);

  const steps = [
    { key: "posted", label: "Posted", done: true, current: false },
    {
      key: "assigned",
      label: "Assigned",
      done: assigned,
      current: !assigned,
    },
    {
      key: "wrapped",
      label: cancelled ? "Closed" : "Completed",
      done: wrappedUp,
      current: assigned && !wrappedUp,
    },
    {
      key: "paid",
      label: "Paid",
      done: paid,
      current: wrappedUp && !paid && !cancelled,
      dim: cancelled,
    },
  ] as const;

  return (
    <div className={styles.wrap} aria-label="Assignment progress">
      <p className={styles.label}>Progress</p>
      <ol className={styles.track}>
        {steps.map((s, i) => {
          const dotClass = [
            styles.dot,
            s.done ? styles.dotDone : "",
            s.current && !s.done ? styles.dotCurrent : "",
            cancelled && s.key === "wrapped" && s.done ? styles.dotCancelled : "",
          ]
            .filter(Boolean)
            .join(" ");

          const capClass = [
            styles.caption,
            s.done ? styles.captionDone : "",
            "dim" in s && s.dim ? styles.captionMuted : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={s.key} className={styles.step}>
              <div className={styles.stepInner}>
                <span className={dotClass} aria-hidden="true">
                  {s.done ? "✓" : i + 1}
                </span>
                <span className={capClass}>{s.label}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
