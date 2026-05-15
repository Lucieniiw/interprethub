/**
 * Stored paths like `/uploads/...` need the API origin when the SPA uses `VITE_API_URL`.
 * The API may return absolute signed URLs (`https://…/api/uploads/read?…`) or relative
 * `/uploads/read?token=…` — both should resolve without double-prefixing.
 */
export function resolveUploadUrl(stored: string | null | undefined): string | undefined {
  if (!stored?.trim()) return undefined;
  const s = stored.trim();
  if (/^https?:\/\//i.test(s)) return s;
  const pathPart = s.startsWith("/") ? s : `/${s}`;
  const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
  if (!apiBase) return pathPart;
  return `${apiBase}${pathPart}`;
}
