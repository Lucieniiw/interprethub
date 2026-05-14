import { escapeHtml } from "./escape.js";

/** Product name in subjects and headers (override with EMAIL_BRAND_NAME). */
export function emailBrandName(): string {
  return process.env.EMAIL_BRAND_NAME?.trim() || "InterpreterHub";
}

/** Organization line in copy (override with EMAIL_BRAND_ORG). */
export function emailOrgName(): string {
  return process.env.EMAIL_BRAND_ORG?.trim() || "International Institute of Wisconsin";
}

/** Palette aligned with IIW-style navy + teal; override via EMAIL_COLOR_PRIMARY / EMAIL_COLOR_ACCENT. */
export function emailTheme(): {
  primary: string;
  accent: string;
  outerBg: string;
  cardBg: string;
  text: string;
  muted: string;
  onPrimary: string;
} {
  return {
    primary: process.env.EMAIL_COLOR_PRIMARY?.trim() || "#1B4F72",
    accent: process.env.EMAIL_COLOR_ACCENT?.trim() || "#0E7490",
    outerBg: process.env.EMAIL_COLOR_OUTER_BG?.trim() || "#e8eef4",
    cardBg: "#ffffff",
    text: "#334155",
    muted: "#64748b",
    onPrimary: "#ffffff",
  };
}

/**
 * Absolute URL for the logo image in HTML emails.
 * Prefer EMAIL_LOGO_URL in production (HTTPS). Else derives from PUBLIC_APP_URL / FRONTEND_ORIGIN + `/email-brand.svg`.
 */
export function emailLogoUrl(): string | null {
  const explicit = process.env.EMAIL_LOGO_URL?.trim();
  if (explicit) return explicit;
  const base = process.env.PUBLIC_APP_URL?.trim() || process.env.FRONTEND_ORIGIN?.trim();
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/email-brand.svg`;
}

/** Localhost / LAN URLs break for external recipients; show text-only header instead of <img>. */
export function emailLogoLoadableByExternalRecipients(url: string | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const h = u.hostname;
    if (h === "localhost" || h === "127.0.0.1") return false;
    if (h.startsWith("192.168.")) return false;
    if (h.startsWith("10.")) return false;
    return true;
  } catch {
    return false;
  }
}

/** Default support address for interpreter services (override with EMAIL_SUPPORT_EMAIL). */
export function emailSupportAddress(): string {
  return process.env.EMAIL_SUPPORT_EMAIL?.trim() || "interpretation@iiwisconsin.org";
}

export function emailSupportFooterHtml(themeAccent: string): string {
  const e = emailSupportAddress();
  const href = `mailto:${encodeURIComponent(e)}`;
  return `<p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#94a3b8">Questions? Contact <a href="${href}" style="color:${escapeHtml(themeAccent)};font-weight:600">${escapeHtml(e)}</a>.</p>`;
}
