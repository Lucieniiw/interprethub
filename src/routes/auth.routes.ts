import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import {
  acceptInviteSchema,
  inviteUserSchema,
  loginSchema,
  registerSchema,
} from "@interpret-hub/shared";
import { prisma } from "../lib/prisma.js";
import { signToken, verifyInviteToken } from "../lib/jwt.js";
import { inviteEmail } from "../lib/email-templates/index.js";
import { sendMailWithJuice } from "../lib/mailer.js";
import { decorateUserForClient } from "../lib/upload-response-decoration.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.middleware.js";
import * as authService from "../services/auth.service.js";

function publicAppOrigin(): string {
  const raw =
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.FRONTEND_ORIGIN?.trim() ||
    "http://localhost:5175";
  return raw.replace(/\/$/, "");
}

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in a few minutes." },
});

authRouter.post("/auth/login", loginLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { email, password } = parsed.data;
    const result = await authService.loginUser(email, password);
    if (result.status === "locked") {
      const err =
        result.role === "INTERPRETER"
          ? "This account has been locked after too many failed sign-in attempts. Contact the administrator at interpretation@iiwisconsin.org to request a password reset."
          : "This account is locked. Contact your coordinator.";
      res.status(403).json({ error: err });
      return;
    }
    if (result.status !== "success") {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const userOut = { ...result.user } as Record<string, unknown>;
    decorateUserForClient(userOut);
    res.json({ token: result.token, user: userOut });
  } catch (err) {
    console.error("[POST /auth/login]", err);
    const dev = process.env.NODE_ENV !== "production";
    const message =
      err instanceof Error ? err.message : "Unexpected error during login";
    res.status(500).json({
      error: dev ? message : "Login temporarily unavailable.",
    });
  }
});

authRouter.post("/auth/register", requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth?.role !== "ADMIN" && req.auth?.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (parsed.data.role === "SUPER_ADMIN" && req.auth!.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Only super admins can create super admin accounts." });
    return;
  }
  const { name, email, password, role, languages } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, authService.BCRYPT_COST);
  const user = await authService.registerUser({
    name,
    email,
    passwordHash,
    role,
    languages: languages ?? [],
  });
  const userOut = { ...user } as Record<string, unknown>;
  decorateUserForClient(userOut);
  res.status(201).json({ user: userOut });
});

authRouter.get("/auth/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await authService.getPublicUserById(req.auth!.sub);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const userOut = { ...user } as Record<string, unknown>;
  decorateUserForClient(userOut);
  res.json(userOut);
});

authRouter.post("/auth/invite-user", requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth?.role !== "ADMIN" && req.auth?.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const parsed = inviteUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (parsed.data.role === "SUPER_ADMIN" && req.auth!.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Only super admins can create super admin accounts." });
    return;
  }
  const { name, email, role, languages } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }
  try {
    const user = await authService.createInvitedUser({
      name,
      email,
      role,
      languages: languages ?? [],
    });
    const inviteToken = authService.buildInviteTokenForUser(user.id, user.email);
    const inviteLink = `${publicAppOrigin()}/accept-invite?token=${encodeURIComponent(inviteToken)}`;

    const smtpConfigured = Boolean(process.env.SMTP_HOST?.trim());
    if (smtpConfigured) {
      try {
        const { subject, htmlBody } = inviteEmail({
          recipientName: user.name,
          inviteLink,
        });
        await sendMailWithJuice({
          to: user.email,
          subject,
          htmlBody,
        });
      } catch (err) {
        console.error("[POST /auth/invite-user] email send failed", err);
        res.status(500).json({
          error: "The user was created but the invitation email could not be sent. Try again or share the link manually.",
          inviteLink,
        });
        return;
      }
    }

    const pub = authService.toPublicUser(user);
    const userOut = { ...pub } as Record<string, unknown>;
    decorateUserForClient(userOut);
    res.status(201).json({
      user: userOut,
      emailSent: smtpConfigured,
      ...(smtpConfigured ? {} : { inviteLink }),
    });
  } catch (err) {
    console.error("[POST /auth/invite-user]", err);
    res.status(500).json({ error: "Could not create invitation." });
  }
});

authRouter.get("/auth/invite-preview", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }
  try {
    const { sub, email } = verifyInviteToken(token);
    const row = await prisma.user.findUnique({
      where: { id: sub },
      select: { name: true, email: true },
    });
    if (!row || row.email !== email) {
      res.status(400).json({ error: "Invalid invite" });
      return;
    }
    res.json({ name: row.name, email: row.email });
  } catch {
    res.status(400).json({ error: "Invalid or expired invite link." });
  }
});

authRouter.post("/auth/accept-invite", async (req, res) => {
  const parsed = acceptInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const { sub, email } = verifyInviteToken(parsed.data.token);
    const publicUser = await authService.setPasswordFromInvite(sub, email, parsed.data.password);
    if (!publicUser) {
      res.status(400).json({ error: "Invalid invite" });
      return;
    }
    const full = await prisma.user.findUnique({ where: { id: sub } });
    if (!full) {
      res.status(500).json({ error: "User not found" });
      return;
    }
    const token = signToken({
      sub: full.id,
      email: full.email,
      role: full.role,
    });
    const userOut = { ...authService.toPublicUser(full) } as Record<string, unknown>;
    decorateUserForClient(userOut);
    res.json({ token, user: userOut });
  } catch {
    res.status(400).json({ error: "Invalid or expired invite link." });
  }
});
