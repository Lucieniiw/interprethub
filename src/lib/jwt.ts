import jwt, { type SignOptions } from "jsonwebtoken";
import { UserRole } from "#prisma-client";

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return s;
};

/** Session / API access token (not email magic links). Override with JWT_EXPIRES_IN (e.g. 24h, 7d). */
const SESSION_JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN?.trim() || "7d") as NonNullable<SignOptions["expiresIn"]>;

/** Invite + password-reset links sent by email (must match copy in transactional templates). */
const EMAIL_MAGIC_LINK_EXPIRES_IN = "12h" as NonNullable<SignOptions["expiresIn"]>;

export type JwtPayload = {
  sub: number;
  email: string;
  role: UserRole;
};

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: SESSION_JWT_EXPIRES_IN });
}

const USER_ROLES = new Set<string>(Object.values(UserRole));

function parseUserRole(value: unknown): UserRole {
  if (typeof value !== "string" || !USER_ROLES.has(value)) {
    throw new Error("Invalid token role");
  }
  return value as UserRole;
}

export function verifyToken(token: string): JwtPayload {
  const raw = jwt.verify(token, secret()) as Record<string, unknown>;
  const sub = Number(raw.sub);
  if (!Number.isFinite(sub) || sub < 1) {
    throw new Error("Invalid token subject");
  }
  return {
    sub,
    email: String(raw.email ?? ""),
    role: parseUserRole(raw.role),
  };
}

export type InviteTokenPayload = {
  sub: number;
  email: string;
  typ: "invite";
};

export function signInviteToken(userId: number, email: string): string {
  return jwt.sign({ sub: userId, email, typ: "invite" }, secret(), { expiresIn: EMAIL_MAGIC_LINK_EXPIRES_IN });
}

export function verifyInviteToken(token: string): InviteTokenPayload {
  const p = jwt.verify(token, secret()) as Record<string, unknown>;
  if (p.typ !== "invite") {
    throw new Error("Invalid invite token");
  }
  const sub = Number(p.sub);
  if (!Number.isInteger(sub) || sub < 1) {
    throw new Error("Invalid invite token");
  }
  const email = typeof p.email === "string" ? p.email.trim() : "";
  if (!email || email.length > 254) {
    throw new Error("Invalid invite token");
  }
  const at = email.indexOf("@");
  if (at < 1 || at === email.length - 1 || email.includes(" ") || email.includes("\n")) {
    throw new Error("Invalid invite token");
  }
  return { typ: "invite", sub, email };
}

/** Signed email links for claim / decline without logging in */
export type JobActionTokenPayload = {
  typ: "job_action";
  jobId: number;
  interpreterId: number;
  act: "claim" | "decline";
};

const JOB_ACTION_JWT_EXPIRES_IN = (process.env.JOB_ACTION_TOKEN_EXPIRES_IN?.trim() ||
  "7d") as NonNullable<SignOptions["expiresIn"]>;

export function signJobActionToken(payload: Omit<JobActionTokenPayload, "typ">): string {
  const body: JobActionTokenPayload = { typ: "job_action", ...payload };
  return jwt.sign(body, secret(), { expiresIn: JOB_ACTION_JWT_EXPIRES_IN });
}

export function verifyJobActionToken(token: string): JobActionTokenPayload {
  const p = jwt.verify(token, secret()) as Record<string, unknown>;
  if (p.typ !== "job_action") {
    throw new Error("Invalid job action token");
  }
  if (p.act !== "claim" && p.act !== "decline") {
    throw new Error("Invalid job action");
  }
  const jobId = Number(p.jobId);
  const interpreterId = Number(p.interpreterId);
  if (!Number.isFinite(jobId) || !Number.isFinite(interpreterId)) {
    throw new Error("Invalid job action token");
  }
  if (!Number.isInteger(jobId) || jobId < 1 || !Number.isInteger(interpreterId) || interpreterId < 1) {
    throw new Error("Invalid job action token");
  }
  return { typ: "job_action", jobId, interpreterId, act: p.act };
}
