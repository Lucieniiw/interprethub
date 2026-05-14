/** Fields required for search/filter on assignments & schedule calendars */

export type JobForScheduleFilter = {
  id: number;
  jobCode: string | null;
  status: string;
  recipientName: string | null;
  requesterName: string | null;
  translationClientName?: string | null;
  client?: { id: number; name: string } | null;
  interpreter?: { id: number; name: string } | null;
};

export function matchesScheduleSearch(job: JobForScheduleFilter, query: string): boolean {
  const raw = query.trim();
  if (!raw) return true;
  const hay = [
    String(job.id),
    job.jobCode ?? "",
    job.client?.name ?? "",
    job.interpreter?.name ?? "",
    job.recipientName ?? "",
    job.requesterName ?? "",
    job.translationClientName ?? "",
  ]
    .join(" ")
    .toLowerCase();
  const tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every((t) => hay.includes(t));
}

export function filterJobsForSchedule<T extends JobForScheduleFilter>(
  jobs: T[],
  opts: {
    search: string;
    status: string;
    clientId: string;
    interpreterId: string;
  },
): T[] {
  let out = jobs;

  if (opts.search.trim()) {
    out = out.filter((j) => matchesScheduleSearch(j, opts.search));
  }
  if (opts.status) {
    out = out.filter((j) => j.status === opts.status);
  }
  if (opts.clientId) {
    const cid = Number(opts.clientId);
    out = out.filter((j) => j.client?.id === cid);
  }
  if (opts.interpreterId) {
    const iid = Number(opts.interpreterId);
    out = out.filter((j) => j.interpreter?.id === iid);
  }
  return out;
}

export function uniqueClientsFromJobs(jobs: JobForScheduleFilter[]): { id: number; name: string }[] {
  const m = new Map<number, string>();
  for (const j of jobs) {
    if (j.client?.id != null) m.set(j.client.id, j.client.name);
  }
  return [...m.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function uniqueInterpretersFromJobs(jobs: JobForScheduleFilter[]): { id: number; name: string }[] {
  const m = new Map<number, string>();
  for (const j of jobs) {
    if (j.interpreter?.id != null) m.set(j.interpreter.id, j.interpreter.name);
  }
  return [...m.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const SCHEDULE_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "PAID", label: "Paid" },
] as const;
