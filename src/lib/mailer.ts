import nodemailer from "nodemailer";
import juice from "juice";

export type SendMailOptions = {
  to: string;
  subject: string;
  /** Fragment or full HTML; CSS is inlined with Juice before send */
  htmlBody: string;
};

function createTransport(): nodemailer.Transporter {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = port === 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  const debug = process.env.SMTP_DEBUG === "1";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    tls: { minVersion: "TLSv1.2" },
    debug,
    logger: debug,
  });
}

/** Throws if SMTP is configured but login/handshake fails (good for CLI / health checks). */
export async function verifySmtpConnection(): Promise<void> {
  if (!process.env.SMTP_HOST?.trim()) {
    throw new Error("SMTP_HOST is not set.");
  }
  const transport = createTransport();
  await transport.verify();
}

function enhanceSendError(err: unknown): Error {
  const base = err instanceof Error ? err : new Error(String(err));
  const code =
    err && typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code)
      : "";
  if (code === "EAUTH" || base.message.includes("535")) {
    base.message +=
      " — For SendGrid: SMTP_USER must be the literal `apikey`, SMTP_PASS must be a Mail Send API key (usually starts with SG.), and SMTP_FROM must be a verified sender.";
  }
  return base;
}

/**
 * Inlines `<style>` / linked CSS into tags using Juice (required stack piece).
 */
export async function sendMailWithJuice(options: SendMailOptions): Promise<void> {
  const html = juice(options.htmlBody);
  const from = process.env.SMTP_FROM?.trim() || "noreply@localhost";

  const transport = createTransport();

  try {
    await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html,
    });
  } catch (err) {
    throw enhanceSendError(err);
  }
}
