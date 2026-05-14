export type PayDayToken = number | "LAST";

/** Parse `15,LAST` style schedule; defaults to 15th and last day of month. */
export function parseLinguistPaydays(raw: string | null | undefined): PayDayToken[] {
  if (!raw?.trim()) return [15, "LAST"];
  const out: PayDayToken[] = [];
  for (const part of raw.split(",")) {
    const p = part.trim().toUpperCase();
    if (!p) continue;
    if (p === "LAST") {
      out.push("LAST");
      continue;
    }
    const n = Number(p);
    if (Number.isInteger(n) && n >= 1 && n <= 31) out.push(n);
  }
  return out.length ? out : [15, "LAST"];
}

export function lastDayOfMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

/** Distinct calendar dates (local) in the month that match the schedule, sorted ascending. */
export function payDatesInMonth(year: number, monthIndex0: number, tokens: PayDayToken[]): Date[] {
  const cap = lastDayOfMonth(year, monthIndex0);
  const domSet = new Set<number>();
  for (const t of tokens) {
    if (t === "LAST") domSet.add(cap);
    else if (t >= 1 && t <= cap) domSet.add(t);
  }
  return [...domSet]
    .sort((a, b) => a - b)
    .map((dom) => new Date(year, monthIndex0, dom, 12, 0, 0, 0));
}

/** Smallest scheduled pay date on or after the calendar day of `ref` (local). */
export function nextPaydayOnOrAfter(ref: Date, tokens: PayDayToken[]): Date {
  const r = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
  let y = r.getFullYear();
  let m = r.getMonth();
  for (let step = 0; step < 48; step++) {
    const dates = payDatesInMonth(y, m, tokens);
    for (const dt of dates) {
      const d0 = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, 0, 0, 0);
      if (d0.getTime() >= r.getTime()) return d0;
    }
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return r;
}
