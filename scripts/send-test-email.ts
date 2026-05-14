/**
 * Sends one test message via SMTP (same stack as the app).
 * Loads InterpretHub/.env first — run from repo root: `pnpm exec tsx scripts/send-test-email.ts you@email.com`
 */
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** Prefer values from `.env` over inherited shell / tooling-injected vars (common cause of “wrong” SMTP_PASS). */
config({ path: path.join(root, ".env"), override: true });

const to = process.argv[2]?.trim();
if (!to) {
  console.error("Usage: pnpm exec tsx scripts/send-test-email.ts <recipient@email.com>");
  process.exit(1);
}

if (!process.env.SMTP_HOST?.trim()) {
  console.error("SMTP_HOST is not set in .env");
  process.exit(1);
}

/** SendGrid SMTP: username must be the literal string `apikey`, password is the SG API key (trim whitespace). */
const smtpUser = process.env.SMTP_USER?.trim();
const smtpPass = process.env.SMTP_PASS?.trim();
const hostLower = process.env.SMTP_HOST?.trim().toLowerCase() ?? "";
if (hostLower.includes("sendgrid") && smtpUser !== "apikey") {
  console.error(
    `[smtp] SendGrid requires SMTP_USER=apikey (literal word), not your email address. Fix .env and retry.`,
  );
  process.exit(1);
}
if (hostLower.includes("sendgrid") && smtpPass && !smtpPass.startsWith("SG.")) {
  console.warn(
    "[smtp] SendGrid API keys usually start with SG. If auth fails, create a key under Settings → API Keys with Mail Send.",
  );
}
if (smtpPass && /\s/.test(process.env.SMTP_PASS ?? "")) {
  console.warn("[smtp] SMTP_PASS contained whitespace; using trimmed value (check your .env).");
}

const { sendMailWithJuice, verifySmtpConnection } = await import("../src/lib/mailer.js");
const { smtpTestEmail } = await import("../src/lib/email-templates/index.js");

try {
  await verifySmtpConnection();
} catch (err) {
  console.error(
    "[smtp] SMTP verify failed (before send):",
    err instanceof Error ? err.message : err,
  );
  console.error(
    "[smtp] Check SMTP_HOST, SMTP_PORT, SMTP_USER=apikey, SMTP_PASS (SendGrid API key), and network/firewall.",
  );
  process.exit(1);
}

try {
  const appBase =
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.FRONTEND_ORIGIN?.trim() ||
    "http://localhost:5175";
  const shortName = to.includes("@") ? to.split("@")[0] : to;
  const { subject, htmlBody } = smtpTestEmail({
    recipientName: shortName,
    sentAtIso: new Date().toISOString(),
    appBaseUrl: appBase,
  });
  await sendMailWithJuice({
    to,
    subject: `${subject} (CLI)`,
    htmlBody,
  });
} catch (err) {
  console.error("[smtp] Send failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}

console.log(`Sent test email to ${to}`);
