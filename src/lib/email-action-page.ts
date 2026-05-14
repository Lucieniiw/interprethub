import type { Response } from "express";
import { emailBrandName } from "./email-templates/branding.js";
import { escapeHtml } from "./email-templates/escape.js";
import { publicBrowserOrigin } from "./public-url.js";

/**
 * API responses use helmet `form-action 'none'`, which blocks HTML forms. Email claim/decline
 * flows return minimal HTML with a POST form — relax CSP only for these pages.
 */
export function applyEmailHtmlSecurityHeaders(res: Response): void {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; style-src 'unsafe-inline'",
  );
}

export function sendEmailActionHtml(res: Response, status: number, html: string): void {
  applyEmailHtmlSecurityHeaders(res);
  res.status(status).type("html").send(html);
}

/** Minimal HTML page shown after POST claim/decline from email (no SPA). */
export function emailActionResultHtml(opts: { title: string; message: string; ok: boolean }): string {
  const brand = escapeHtml(emailBrandName());
  const origin = escapeHtml(publicBrowserOrigin());
  const panelBg = opts.ok ? "#ecfdf5" : "#fffbeb";
  const accent = opts.ok ? "#0E7490" : "#b45306";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f1f5f9;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:${panelBg};border-radius:12px;padding:28px;border-left:4px solid ${accent};box-shadow:0 4px 16px rgba(15,23,42,0.08)">
    <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a">${escapeHtml(opts.title)}</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.55;color:#334155">${escapeHtml(opts.message)}</p>
    <p style="margin:0;font-size:14px">
      <a href="${origin}" style="color:${accent};font-weight:600;text-decoration:none">${brand} — open app</a>
    </p>
  </div>
</body>
</html>`;
}

/** GET after following email link — user must POST to complete (avoids prefetch/scanner side effects). */
export function emailActionConfirmHtml(opts: {
  act: "claim" | "decline";
  jobId: number;
  token: string;
  postUrl: string;
}): string {
  const title = opts.act === "claim" ? "Confirm claim" : "Confirm decline";
  const lead =
    opts.act === "claim"
      ? `You are about to claim open assignment #${opts.jobId}. This will assign it to you if it is still open.`
      : `You are about to decline open assignment #${opts.jobId}. You will not be offered this assignment again.`;
  const button =
    opts.act === "claim"
      ? "Confirm — claim assignment"
      : "Confirm — decline assignment";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f1f5f9;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border-left:4px solid #0E7490;box-shadow:0 4px 16px rgba(15,23,42,0.08)">
    <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a">${escapeHtml(title)}</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.55;color:#334155">${escapeHtml(lead)}</p>
    <form method="post" action="${escapeHtml(opts.postUrl)}" style="margin:0">
      <input type="hidden" name="token" value="${escapeHtml(opts.token)}" />
      <button type="submit" style="display:inline-block;padding:14px 28px;background:#0E7490;color:#ffffff;font-family:inherit;font-size:15px;font-weight:600;border:none;border-radius:8px;cursor:pointer">
        ${escapeHtml(button)}
      </button>
    </form>
    <p style="margin:20px 0 0;font-size:13px;color:#64748b">If you did not open this page on purpose, close the tab — no change has been made yet.</p>
  </div>
</body>
</html>`;
}
