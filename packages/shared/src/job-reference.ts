export type JobReferenceInput = {
  id: number;
  jobCode?: string | null;
};

/**
 * Default human-facing job identifier: `YYT-NNNN` (e.g. `26T-0001`) when set,
 * otherwise `#` + numeric id for legacy rows without a code.
 */
export function formatJobReference(job: JobReferenceInput): string {
  const code = typeof job.jobCode === "string" ? job.jobCode.trim() : "";
  if (code) return code;
  return `#${job.id}`;
}
