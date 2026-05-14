import type { CorsOptions } from "cors";

/**
 * CORS origin(s) for Express and Socket.IO.
 * Production: `FRONTEND_ORIGIN` is required (comma-separated list allowed).
 * Development: omit to allow any origin (reflect); set to restrict dev clients.
 */
export function getCorsOrigin(): CorsOptions["origin"] {
  const raw = process.env.FRONTEND_ORIGIN?.trim();
  const prod = process.env.NODE_ENV === "production";

  if (prod) {
    if (!raw) {
      throw new Error("FRONTEND_ORIGIN must be set in production (comma-separated allowed origins).");
    }
    const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) {
      throw new Error("FRONTEND_ORIGIN is empty.");
    }
    return list.length === 1 ? list[0]! : list;
  }

  if (!raw) return true;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length === 1 ? list[0]! : list;
}
