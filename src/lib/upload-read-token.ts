import crypto from "crypto";
import path from "path";
import { JOB_ATTACHMENT_PUBLIC_PREFIX } from "./job-attachment-storage.js";
import { PROFILE_PHOTO_PUBLIC_PREFIX } from "./profile-photo-storage.js";

function signingSecret(): string {
  const u = process.env.UPLOAD_READ_SECRET?.trim();
  if (u) return u;
  const j = process.env.JWT_SECRET?.trim();
  if (!j) throw new Error("JWT_SECRET is not set");
  return j;
}

/** Stored paths we allow to resolve to disk (basename-only under known dirs). */
export function isAllowedUploadStoredPath(publicPath: string): boolean {
  const norm = publicPath.trim().replace(/\\/g, "/");
  if (!norm.startsWith("/") || norm.includes("..")) return false;
  const name = path.posix.basename(norm);
  if (!name) return false;
  if (norm.startsWith(`${JOB_ATTACHMENT_PUBLIC_PREFIX}/`)) return true;
  if (norm.startsWith(`${PROFILE_PHOTO_PUBLIC_PREFIX}/`)) return true;
  return false;
}

export function signUploadReadToken(publicPath: string, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = JSON.stringify({ p: publicPath.trim(), exp });
  const sig = crypto.createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  const body = Buffer.from(payload, "utf8").toString("base64url");
  return `${body}.${sig}`;
}

export function verifyUploadReadToken(token: string): { path: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [bodyB64, sigB64] = parts;
  if (!bodyB64 || !sigB64) return null;
  let payload: string;
  try {
    payload = Buffer.from(bodyB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expectedSig = crypto.createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(sigB64, "base64url");
    b = Buffer.from(expectedSig, "base64url");
  } catch {
    return null;
  }
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data: { p?: unknown; exp?: unknown };
  try {
    data = JSON.parse(payload) as { p?: unknown; exp?: unknown };
  } catch {
    return null;
  }
  if (typeof data.p !== "string" || typeof data.exp !== "number") return null;
  if (data.exp < Math.floor(Date.now() / 1000)) return null;
  if (!isAllowedUploadStoredPath(data.p)) return null;
  return { path: data.p };
}
