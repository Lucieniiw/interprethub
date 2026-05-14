import crypto from "crypto";
import bcrypt from "bcryptjs";
import { UserRole } from "#prisma-client";
import { prisma } from "../lib/prisma.js";
import { signInviteToken, signToken } from "../lib/jwt.js";

/** OWASP-aligned cost; ~250ms per hash on typical server hardware at 12. */
export const BCRYPT_COST = 12;

export type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  languages: string[];
  profilePhoto: string | null;
  residentialCounty: string | null;
};

export function toPublicUser(u: {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  languages: string[];
  profilePhoto: string | null;
  residentialCounty: string | null;
}): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    languages: u.languages,
    profilePhoto: u.profilePhoto,
    residentialCounty: u.residentialCounty,
  };
}

export type LoginResult =
  | { status: "success"; token: string; user: PublicUser }
  | { status: "invalid_credentials" }
  | { status: "locked"; role: UserRole };

const INTERPRETER_LOGIN_LOCK_AFTER = 5;

export async function loginUser(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { status: "invalid_credentials" };
  if (user.accountLocked) return { status: "locked", role: user.role };

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    if (user.role !== UserRole.INTERPRETER) {
      return { status: "invalid_credentials" };
    }
    const prev = user.failedLoginAttempts ?? 0;
    const next = prev + 1;
    if (next >= INTERPRETER_LOGIN_LOCK_AFTER) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: next, accountLocked: true },
      });
      return { status: "locked", role: UserRole.INTERPRETER };
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: next },
    });
    return { status: "invalid_credentials" };
  }

  if (user.failedLoginAttempts > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0 },
    });
  }

  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  return { status: "success", token, user: toPublicUser(user) };
}

export async function getPublicUserById(id: number): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toPublicUser(user) : null;
}

export async function registerUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  languages: string[];
}) {
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role,
      languages: input.languages,
    },
  });
  return toPublicUser(user);
}

/** Creates user with a random unknown password until they complete invite. */
export async function createInvitedUser(input: {
  name: string;
  email: string;
  role: UserRole;
  languages: string[];
}) {
  const placeholder = crypto.randomBytes(48).toString("hex");
  const passwordHash = await bcrypt.hash(placeholder, BCRYPT_COST);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      languages: input.languages,
    },
  });
  return user;
}

export function buildInviteTokenForUser(userId: number, email: string): string {
  return signInviteToken(userId, email);
}

export async function setPasswordFromInvite(userId: number, expectedEmail: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.email !== expectedEmail) return null;
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, failedLoginAttempts: 0 },
  });
  const updated = await prisma.user.findUnique({ where: { id: userId } });
  return updated ? toPublicUser(updated) : null;
}

/** Same accept-invite flow; link lets the user choose a new password. */
export function buildPasswordResetLinkForUser(userId: number, email: string): string {
  const token = buildInviteTokenForUser(userId, email);
  const raw =
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.FRONTEND_ORIGIN?.trim() ||
    "http://localhost:5175";
  const origin = raw.replace(/\/$/, "");
  return `${origin}/accept-invite?token=${encodeURIComponent(token)}`;
}
