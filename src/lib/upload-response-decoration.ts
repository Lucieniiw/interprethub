import { signedReadUrlForStoredPath } from "./upload-public-url.js";

/** Shorter TTL limits exposure if a signed URL leaks (Referrer, logs, shared links). */
const SIGNED_UPLOAD_READ_TTL_SECONDS = 3600;

function isAlreadySignedUploadUrl(url: string): boolean {
  return url.includes("/api/uploads/read?") || url.includes("uploads/read?token=");
}

function decorateInterpreter(interpreter: unknown): void {
  if (!interpreter || typeof interpreter !== "object") return;
  const row = interpreter as Record<string, unknown>;
  if (typeof row.profilePhoto === "string" && row.profilePhoto.trim()) {
    if (isAlreadySignedUploadUrl(row.profilePhoto)) return;
    const next = signedReadUrlForStoredPath(row.profilePhoto, SIGNED_UPLOAD_READ_TTL_SECONDS);
    if (next) row.profilePhoto = next;
  }
}

/** Replace stored `/uploads/...` paths on job payloads returned to clients. */
export function decorateJobForClient(job: Record<string, unknown>): void {
  if (typeof job.attachmentUrl === "string" && job.attachmentUrl.trim()) {
    if (!isAlreadySignedUploadUrl(job.attachmentUrl)) {
      const next = signedReadUrlForStoredPath(job.attachmentUrl, SIGNED_UPLOAD_READ_TTL_SECONDS);
      if (next) job.attachmentUrl = next;
    }
  }
  decorateInterpreter(job.interpreter);
}

export function decorateUserForClient(user: Record<string, unknown>): void {
  if (typeof user.profilePhoto === "string" && user.profilePhoto.trim()) {
    if (isAlreadySignedUploadUrl(user.profilePhoto)) return;
    const next = signedReadUrlForStoredPath(user.profilePhoto, SIGNED_UPLOAD_READ_TTL_SECONDS);
    if (next) user.profilePhoto = next;
  }
}

export function decorateJobsArrayForClient(jobs: unknown[]): void {
  for (const j of jobs) {
    if (j && typeof j === "object") decorateJobForClient(j as Record<string, unknown>);
  }
}

export function decorateStaffUserRows(rows: unknown[]): void {
  for (const r of rows) {
    if (r && typeof r === "object") decorateUserForClient(r as Record<string, unknown>);
  }
}
