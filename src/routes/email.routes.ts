import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { smtpTestEmail } from "../lib/email-templates/index.js";
import { sendMailWithJuice } from "../lib/mailer.js";

export const emailRouter = Router();

/** Sends a single test message to the signed-in user's email (verifies SMTP / SendGrid). */
emailRouter.post("/email/test", requireAuth, async (req: AuthedRequest, res) => {
  if (!process.env.SMTP_HOST?.trim()) {
    res.status(400).json({
      error: "SMTP is not configured. Set SMTP_HOST, SMTP_PASS, and SMTP_FROM in your environment.",
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.auth!.sub },
    select: { email: true, name: true },
  });
  if (!user?.email?.trim()) {
    res.status(400).json({ error: "Your account has no email address." });
    return;
  }

  const base =
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.FRONTEND_ORIGIN?.trim() ||
    "http://localhost:5175";

  try {
    const { subject, htmlBody } = smtpTestEmail({
      recipientName: user.name,
      sentAtIso: new Date().toISOString(),
      appBaseUrl: base,
    });
    await sendMailWithJuice({
      to: user.email.trim(),
      subject,
      htmlBody,
    });
  } catch (err) {
    console.error("[POST /email/test]", err);
    const msg = err instanceof Error ? err.message : "Send failed.";
    res.status(500).json({
      error: `Email could not be sent: ${msg}`,
    });
    return;
  }

  res.json({ ok: true, sentTo: user.email.trim() });
});
