import { isAllowedUploadStoredPath, signUploadReadToken } from "./upload-read-token.js";

/**
 * Public browser-facing origin for the API (signed file URLs, absolute links).
 * Prefer API_PUBLIC_URL when the SPA is on a different host than the API.
 */
export function getApiPublicOrigin(): string {
  const raw =
    process.env.API_PUBLIC_URL?.trim() ||
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.FRONTEND_ORIGIN?.trim()?.split(",")[0]?.trim() ||
    "";
  return raw.replace(/\/$/, "");
}

/** Turn a stored `/uploads/...` path into a time-limited signed read URL. */
export function signedReadUrlForStoredPath(
  publicPath: string | null | undefined,
  ttlSeconds = 3600,
): string | null {
  if (!publicPath?.trim()) return null;
  const p = publicPath.trim();
  if (!isAllowedUploadStoredPath(p)) return null;
  const token = signUploadReadToken(p, ttlSeconds);
  const origin = getApiPublicOrigin();
  const suffix = `/api/uploads/read?token=${encodeURIComponent(token)}`;
  if (origin) return `${origin}${suffix}`;
  return suffix;
}
