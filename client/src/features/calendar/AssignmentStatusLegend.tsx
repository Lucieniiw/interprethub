import { ASSIGNMENT_LEGEND_ITEMS } from "./jobCalendarColors";
import styles from "./AssignmentStatusLegend.module.css";

export function AssignmentStatusLegend({ className }: { className?: string }) {
  return (
    <div
      className={[styles.legend, className].filter(Boolean).join(" ")}
      role="group"
      aria-label="Assignment status colors"
    >
      <p className={styles.title}>Legend</p>
      {ASSIGNMENT_LEGEND_ITEMS.map(({ status, label, style }) => (
        <div key={status} className={styles.item}>
          <span
            className={styles.swatch}
            style={{
              backgroundColor: style.backgroundColor,
              borderColor: style.borderColor,
            }}
            aria-hidden
          />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
