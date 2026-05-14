import {
  emailBrandName,
  emailLogoLoadableByExternalRecipients,
  emailLogoUrl,
  emailOrgName,
  emailSupportFooterHtml,
  emailTheme,
} from "./branding.js";
import { escapeHtml } from "./escape.js";

export type EmailLayoutOptions = {
  /** Main title inside the card */
  headline: string;
  /** Shown in inbox preview / hidden preheader */
  previewText?: string;
  /** Trusted HTML fragments (from our builders only) */
  innerHtml: string;
  primaryButton?: { label: string; href: string };
  /** Small gray text below the button */
  secondaryNote?: string;
};

/**
 * Shared responsive-friendly wrapper for transactional mail (tables for clients that strip flexbox).
 */
export function wrapEmailLayout(opts: EmailLayoutOptions): string {
  const theme = emailTheme();
  const brand = escapeHtml(emailBrandName());
  const org = escapeHtml(emailOrgName());
  const preview = escapeHtml(opts.previewText ?? opts.headline);

  const logoUrl = emailLogoUrl();
  const showLogoImg = Boolean(logoUrl && emailLogoLoadableByExternalRecipients(logoUrl));

  const headerBlock = showLogoImg
    ? `<img src="${escapeHtml(logoUrl!)}" alt="${org}" width="220" style="display:block;max-width:220px;height:auto;margin:0 0 12px;border:0;outline:none;text-decoration:none" />`
    : `<p style="margin:0 0 6px;font-size:20px;font-weight:700;color:${theme.onPrimary};letter-spacing:-0.02em">${brand}</p>
       <p style="margin:0;font-size:14px;font-weight:500;color:rgba(255,255,255,0.92);line-height:1.45">${org}</p>`;

  const buttonRow =
    opts.primaryButton != null
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0">
          <tr>
            <td align="center" style="border-radius:8px;background:${theme.accent}">
              <a href="${escapeHtml(opts.primaryButton.href)}" target="_blank" rel="noopener noreferrer"
                style="display:inline-block;padding:14px 28px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background:${theme.accent}">
                ${escapeHtml(opts.primaryButton.label)}
              </a>
            </td>
          </tr>
        </table>`
      : "";

  const noteRow =
    opts.secondaryNote != null
      ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:${theme.muted}">${escapeHtml(opts.secondaryNote)}</p>`
      : "";

  const support = emailSupportFooterHtml(theme.accent);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="x-ua-compatible" content="ie=edge" />
  <title>${escapeHtml(opts.headline)}</title>
</head>
<body style="margin:0;padding:0;background:${theme.outerBg};-webkit-font-smoothing:antialiased;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${preview}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${theme.outerBg};padding:28px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${theme.cardBg};border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(27,79,114,0.12)">
          <tr>
            <td style="background:${theme.primary};padding:24px 32px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
              ${headerBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
              <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;font-weight:700;color:#0f172a">${escapeHtml(opts.headline)}</h1>
              <div style="font-size:15px;line-height:1.65;color:${theme.text}">${opts.innerHtml}</div>
              ${buttonRow}
              ${noteRow}
              <hr style="margin:28px 0;border:none;border-top:1px solid #e2e8f0" />
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8">
                You received this email because of an action in ${brand}.
              </p>
              ${support}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
