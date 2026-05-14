/** Calendar colors for job statuses — shared by Assignments (admin) and My Schedule (linguists). */

export type JobCalendarStyle = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
};

const FALLBACK: JobCalendarStyle = {
  backgroundColor: "rgba(100, 116, 139, 0.35)",
  borderColor: "#64748b",
  textColor: "#e2e8f0",
};

const MAP: Record<string, JobCalendarStyle> = {
  /** Open — needs a linguist */
  OPEN: {
    backgroundColor: "#2563eb",
    borderColor: "#1d4ed8",
    textColor: "#ffffff",
  },
  /** Assigned to an interpreter */
  ASSIGNED: {
    backgroundColor: "#16a34a",
    borderColor: "#15803d",
    textColor: "#ffffff",
  },
  /** Session completed */
  COMPLETED: {
    backgroundColor: "#ca8a04",
    borderColor: "#a16207",
    textColor: "#ffffff",
  },
  /** Cancelled */
  CANCELLED: {
    backgroundColor: "#dc2626",
    borderColor: "#b91c1c",
    textColor: "#ffffff",
  },
  /** Paid / closed */
  PAID: {
    backgroundColor: "#0f766e",
    borderColor: "#0d9488",
    textColor: "#ffffff",
  },
};

export function calendarStyleForJobStatus(status: string): JobCalendarStyle {
  return MAP[status] ?? FALLBACK;
}

export type LegendItem = {
  status: string;
  label: string;
  style: JobCalendarStyle;
};

/** Fixed legend order for UI consistency */
export const ASSIGNMENT_LEGEND_ITEMS: LegendItem[] = [
  { status: "OPEN", label: "Open", style: MAP.OPEN },
  { status: "ASSIGNED", label: "Assigned", style: MAP.ASSIGNED },
  { status: "COMPLETED", label: "Completed", style: MAP.COMPLETED },
  { status: "CANCELLED", label: "Cancelled", style: MAP.CANCELLED },
  { status: "PAID", label: "Paid", style: MAP.PAID },
];
