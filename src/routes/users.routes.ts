import { Router } from "express";
import { updateUserSchema } from "@interpret-hub/shared";
import { prisma } from "../lib/prisma.js";
import { passwordResetEmail } from "../lib/email-templates/index.js";
import { sendMailWithJuice } from "../lib/mailer.js";
import { decorateStaffUserRows, decorateUserForClient } from "../lib/upload-response-decoration.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.middleware.js";
import * as authService from "../services/auth.service.js";
import * as usersService from "../services/users.service.js";

export const usersRouter = Router();

function isStaff(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function parseUserId(raw: string | string[] | undefined): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (typeof s !== "string") return null;
  const id = Number(s);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
}

async function assertCanManageUser(actorRole: string, targetRole: string): Promise<boolean> {
  if (targetRole === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN") return false;
  return true;
}

usersRouter.get("/users", requireAuth, async (req: AuthedRequest, res) => {
  if (!isStaff(req.auth!.role)) {
    res.status(403).json({ error: "Coordinator access required" });
    return;
  }
  const rows = await usersService.listUsersSummary();
  decorateStaffUserRows(rows as unknown[]);
  res.json(rows);
});

usersRouter.get("/users/:id", requireAuth, async (req: AuthedRequest, res) => {
  if (!isStaff(req.auth!.role)) {
    res.status(403).json({ error: "Coordinator access required" });
    return;
  }
  const id = parseUserId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  const row = await usersService.getUserDetailForStaff(id);
  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const out = { ...row } as Record<string, unknown>;
  decorateUserForClient(out);
  res.json(out);
});

usersRouter.patch("/users/:id", requireAuth, async (req: AuthedRequest, res) => {
  if (!isStaff(req.auth!.role)) {
    res.status(403).json({ error: "Coordinator access required" });
    return;
  }
  const id = parseUserId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const target = await usersService.getUserById(id);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (!(await assertCanManageUser(req.auth!.role, target.role))) {
    res.status(403).json({ error: "Only a super admin can modify this account." });
    return;
  }

  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  if (parsed.data.role === "SUPER_ADMIN" && req.auth!.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Only super admins can assign that role." });
    return;
  }

  const { linguistPayRates, ...userPatch } = parsed.data;
  const body = { ...userPatch };

  const finalRole = body.role ?? target.role;
  if (finalRole !== "INTERPRETER") {
    delete body.interpreterStatus;
  }

  const hasUserFieldUpdate = Object.values(body).some((v) => v !== undefined);
  const hasRateUpdate =
    linguistPayRates != null &&
    Object.values(linguistPayRates).some((v) => v !== undefined);

  if (!hasUserFieldUpdate && !hasRateUpdate) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  if (hasRateUpdate && finalRole !== "INTERPRETER") {
    res.status(400).json({ error: "Linguist pay rates apply only to interpreter accounts." });
    return;
  }

  if (body.email && body.email !== target.email) {
    const taken = await prisma.user.findUnique({ where: { email: body.email } });
    if (taken && taken.id !== id) {
      res.status(400).json({ error: "Email already in use" });
      return;
    }
  }

  try {
    if (hasUserFieldUpdate) {
      await usersService.updateUser(id, body);
    }
    if (hasRateUpdate && finalRole === "INTERPRETER") {
      await usersService.upsertInterpreterPayRates(id, linguistPayRates ?? {});
    }
    const updated = await usersService.getUserDetailForStaff(id);
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const out = { ...updated } as Record<string, unknown>;
    decorateUserForClient(out);
    res.json(out);
  } catch (err) {
    console.error("[PATCH /users/:id]", err);
    res.status(500).json({ error: "Could not update user." });
  }
});

usersRouter.delete("/users/:id", requireAuth, async (req: AuthedRequest, res) => {
  if (!isStaff(req.auth!.role)) {
    res.status(403).json({ error: "Coordinator access required" });
    return;
  }
  const id = parseUserId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  if (id === req.auth!.sub) {
    res.status(400).json({ error: "You cannot delete your own account." });
    return;
  }

  const target = await usersService.getUserById(id);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (!(await assertCanManageUser(req.auth!.role, target.role))) {
    res.status(403).json({ error: "Only a super admin can delete this account." });
    return;
  }

  try {
    await usersService.deleteUser(id);
    res.status(204).send();
  } catch (err) {
    console.error("[DELETE /users/:id]", err);
    res.status(500).json({ error: "Could not delete user." });
  }
});

usersRouter.post("/users/:id/unlock", requireAuth, async (req: AuthedRequest, res) => {
  if (!isStaff(req.auth!.role)) {
    res.status(403).json({ error: "Coordinator access required" });
    return;
  }
  const id = parseUserId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const target = await usersService.getUserById(id);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (!(await assertCanManageUser(req.auth!.role, target.role))) {
    res.status(403).json({ error: "Only a super admin can unlock this account." });
    return;
  }

  try {
    const updated = await usersService.unlockUser(id);
    const out = { ...updated } as Record<string, unknown>;
    decorateUserForClient(out);
    res.json(out);
  } catch (err) {
    console.error("[POST /users/:id/unlock]", err);
    res.status(500).json({ error: "Could not unlock account." });
  }
});

usersRouter.post("/users/:id/lock", requireAuth, async (req: AuthedRequest, res) => {
  if (!isStaff(req.auth!.role)) {
    res.status(403).json({ error: "Coordinator access required" });
    return;
  }
  const id = parseUserId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  if (id === req.auth!.sub) {
    res.status(400).json({ error: "You cannot lock your own account." });
    return;
  }

  const target = await usersService.getUserById(id);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (!(await assertCanManageUser(req.auth!.role, target.role))) {
    res.status(403).json({ error: "Only a super admin can lock this account." });
    return;
  }

  try {
    const updated = await usersService.lockUser(id);
    const out = { ...updated } as Record<string, unknown>;
    decorateUserForClient(out);
    res.json(out);
  } catch (err) {
    console.error("[POST /users/:id/lock]", err);
    res.status(500).json({ error: "Could not lock account." });
  }
});

usersRouter.post("/users/:id/password-reset", requireAuth, async (req: AuthedRequest, res) => {
  if (!isStaff(req.auth!.role)) {
    res.status(403).json({ error: "Coordinator access required" });
    return;
  }
  const id = parseUserId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const target = await usersService.getUserById(id);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (!(await assertCanManageUser(req.auth!.role, target.role))) {
    res.status(403).json({ error: "Only a super admin can reset this account password." });
    return;
  }

  const resetLink = authService.buildPasswordResetLinkForUser(target.id, target.email);
  const smtpConfigured = Boolean(process.env.SMTP_HOST?.trim());

  if (smtpConfigured) {
    try {
      const { subject, htmlBody } = passwordResetEmail({
        recipientName: target.name,
        resetLink,
      });
      await sendMailWithJuice({
        to: target.email,
        subject,
        htmlBody,
      });
    } catch (err) {
      console.error("[POST /users/:id/password-reset] email failed", err);
      res.status(500).json({
        error: "Email could not be sent. Copy the link manually or try again.",
        resetLink,
      });
      return;
    }
  }

  res.json({
    emailSent: smtpConfigured,
    ...(smtpConfigured ? {} : { resetLink }),
  });
});
