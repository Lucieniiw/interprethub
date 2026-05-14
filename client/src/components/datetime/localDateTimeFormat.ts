/** Parse `YYYY-MM-DDTHH:mm` as local wall time. */
export function parseLocalDateTimeInput(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  const [datePart, timePart] = t.split("T");
  if (!datePart) return null;
  const [ys, ms, ds] = datePart.split("-").map(Number);
  if ([ys, ms, ds].some((x) => Number.isNaN(x))) return null;
  let h = 0;
  let mi = 0;
  if (timePart) {
    const [hs, mins] = timePart.split(":");
    h = Number(hs);
    mi = Number(mins);
    if (Number.isNaN(h) || Number.isNaN(mi)) return null;
  }
  return new Date(ys, ms - 1, ds, h, mi, 0, 0);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Format local wall time as `YYYY-MM-DDTHH:mm` (datetime-local compatible). */
export function formatLocalDateTimeInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse `YYYY-MM-DD` as local midnight. */
export function parseLocalDateInput(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  const [ys, ms, ds] = t.split("-").map(Number);
  if ([ys, ms, ds].some((x) => Number.isNaN(x))) return null;
  return new Date(ys, ms - 1, ds, 0, 0, 0, 0);
}

export function formatLocalDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MS_PER_HOUR = 60 * 60 * 1000;

export function addHoursToLocalWallTime(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * MS_PER_HOUR);
}

export type PairEndAfterStartChangeOpts = {
  newStartStr: string;
  /** Start value immediately before this edit (same string space as `newStartStr`). */
  previousStartStr: string | null | undefined;
  currentEndStr: string;
  /** Default span when end is inferred (hours). */
  durationHours?: number;
};

/**
 * When the user changes session start, suggest an end time (default +durationHours).
 * Mirrors common calendar UX: first pick sets end; later start edits keep end if the user
 * customized it, but still follow the previous auto-pair or fix an end that is no longer after start.
 */
export function pairEndAfterStartChange(opts: PairEndAfterStartChangeOpts): string {
  const duration = opts.durationHours ?? 2;
  const newStart = parseLocalDateTimeInput(opts.newStartStr);
  if (!newStart) return opts.currentEndStr;

  const currentEnd = parseLocalDateTimeInput(opts.currentEndStr.trim());
  const defaultEndStr = formatLocalDateTimeInput(addHoursToLocalWallTime(newStart, duration));

  if (!opts.currentEndStr.trim() || !currentEnd || currentEnd.getTime() <= newStart.getTime()) {
    return defaultEndStr;
  }

  const prevRaw = opts.previousStartStr?.trim();
  if (prevRaw) {
    const prevStart = parseLocalDateTimeInput(prevRaw);
    if (prevStart) {
      const prevPairedEndStr = formatLocalDateTimeInput(addHoursToLocalWallTime(prevStart, duration));
      if (opts.currentEndStr.trim() === prevPairedEndStr) {
        return defaultEndStr;
      }
    }
  }

  return opts.currentEndStr;
}
