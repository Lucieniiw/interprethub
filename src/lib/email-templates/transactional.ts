import type { Client, Job, User } from "#prisma-client";
import { RecipientType, ServiceCategory, ServiceType } from "#prisma-client";
import { formatJobReference } from "@interpret-hub/shared";
import { emailBrandName, emailSupportAddress, emailTheme } from "./branding.js";
import { escapeHtml } from "./escape.js";
import { wrapEmailLayout } from "./layout.js";

type JobWithRelations = Job & {
  client?: Client | null;
  interpreter?: Pick<User, "id" | "name" | "email"> | null;
};

function serviceTypeLabel(st: ServiceType): string {
  switch (st) {
    case ServiceType.IN_PERSON:
      return "In person";
    case ServiceType.VIRTUAL:
      return "Virtual";
    case ServiceType.PHONE:
      return "Phone";
    default:
      return String(st);
  }
}

function recipientTypeLabel(rt: RecipientType | null | undefined): string {
  if (rt === RecipientType.PATIENT) return "Patient";
  if (rt === RecipientType.STUDENT) return "Student";
  return "";
}

function humanizeInterpretationDomain(raw: string): string {
  const map: Record<string, string> = {
    IMMIGRATION: "Immigration",
    MEDICAL: "Medical",
    SOCIAL_SERVICES: "Social services",
    OTHER: "Other",
  };
  const t = raw.trim();
  if (map[t]) return map[t];
  return t
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

/** Multiline plain text → safe HTML with line breaks */
function escapeMultiline(plain: string): string {
  return escapeHtml(plain).replace(/\r\n/g, "\n").replace(/\n/g, "<br/>");
}

function detailRow(label: string, valueHtml: string): string {
  return `<tr>
  <td style="padding:6px 14px 6px 0;vertical-align:top;color:#64748b;font-weight:600;white-space:nowrap">${escapeHtml(label)}</td>
  <td style="padding:6px 0;vertical-align:top">${valueHtml}</td>
</tr>`;
}

function optionalPlainRow(label: string, value: string | null | undefined): string {
  const v = typeof value === "string" ? value.trim() : value != null ? String(value).trim() : "";
  if (!v) return "";
  return detailRow(label, escapeHtml(v));
}

type AssignmentDetailsAudience = "interpreter_open" | "requester";

/** Shared assignment detail rows for interpreter broadcasts and requester confirmations */
function buildAssignmentDetailsTable(job: JobWithRelations, audience: AssignmentDetailsAudience): string {
  const rows: string[] = [];

  const reference = formatJobReference(job);
  rows.push(detailRow("Job ID", escapeHtml(reference)));

  rows.push(
    detailRow(
      "Category",
      escapeHtml(job.serviceCategory === ServiceCategory.TRANSLATION ? "Translation" : "Interpretation"),
    ),
  );

  const client = job.client;

  if (job.serviceCategory === ServiceCategory.TRANSLATION) {
    rows.push(detailRow("Languages", escapeHtml(`${job.language} → ${job.targetLanguage ?? "—"}`)));
    rows.push(
      detailRow(
        "Due",
        escapeHtml(
          job.translationDueDate ? new Date(job.translationDueDate).toLocaleString() : "—",
        ),
      ),
    );
    rows.push(optionalPlainRow("Subject / client name", job.translationClientName));
    rows.push(detailRow("Format", escapeHtml(serviceTypeLabel(job.serviceType))));
    if (job.rushFee != null && job.rushFee > 0) {
      rows.push(detailRow("Rush fee", escapeHtml(formatUsd(job.rushFee))));
    }
  } else {
    rows.push(detailRow("Modality", escapeHtml(serviceTypeLabel(job.serviceType))));
    if (job.interpretationType?.trim()) {
      rows.push(
        detailRow("Session setting", escapeHtml(humanizeInterpretationDomain(job.interpretationType))),
      );
    }
    rows.push(
      detailRow(
        "Appointment time",
        escapeHtml(
          `${new Date(job.startTime).toLocaleString()} — ${new Date(job.endTime).toLocaleString()}`,
        ),
      ),
    );
    if (job.durationMinutes != null && job.durationMinutes > 0) {
      rows.push(detailRow("Duration", escapeHtml(`${job.durationMinutes} minutes`)));
    }
    rows.push(detailRow("Language", escapeHtml(job.language)));
    rows.push(optionalPlainRow("Location", job.location));
  }

  if (job.rate > 0) {
    rows.push(detailRow("Rate", escapeHtml(`${formatUsd(job.rate)} / hour`)));
  }

  if (client && audience !== "requester") {
    rows.push(optionalPlainRow("Client", client.name));
    rows.push(optionalPlainRow("Organization", client.organization));
    rows.push(optionalPlainRow("Client phone", client.phone));
    rows.push(optionalPlainRow("Client email", client.email));
    rows.push(optionalPlainRow("Industry", client.industry));
    rows.push(optionalPlainRow("Client address", client.address));
  }

  if (audience !== "requester") {
    rows.push(optionalPlainRow("Requester", job.requesterName));
  }

  if (job.recipientName?.trim()) {
    const rt = recipientTypeLabel(job.recipientType);
    const who = rt ? `${rt}: ${job.recipientName.trim()}` : job.recipientName.trim();
    rows.push(detailRow("Recipient", escapeHtml(who)));
  }

  rows.push(optionalPlainRow("Patient / participant", job.patientName));
  rows.push(optionalPlainRow("Staff contact", job.staffName));

  if (job.notes?.trim()) {
    rows.push(detailRow("Notes", escapeMultiline(job.notes.trim())));
  }

  if (job.attachmentUrl?.trim()) {
    const attachmentCopy =
      audience === "requester"
        ? "Yes — included with your request."
        : "Yes — open this assignment in InterpreterHub after you claim to download.";
    rows.push(detailRow("Attachment", escapeHtml(attachmentCopy)));
  }

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;width:100%;max-width:560px;border-collapse:collapse;font-size:14px;line-height:1.5;color:#0f172a">
${rows.join("\n")}
</table>`;
}

export function inviteEmail(args: { recipientName: string; inviteLink: string }): {
  subject: string;
  htmlBody: string;
} {
  const inner = `
<p style="margin:0 0 16px">Hello ${escapeHtml(args.recipientName)},</p>
<p style="margin:0 0 16px">You've been invited to join your team on <strong>${escapeHtml(emailBrandName())}</strong>.
Use the secure link below to choose your password and activate your account.</p>
<p style="margin:0;font-size:14px;color:#64748b">If you did not expect this invitation, you can ignore this email.</p>`;

  return {
    subject: `You're invited — ${emailBrandName()}`,
    htmlBody: wrapEmailLayout({
      headline: "Activate your account",
      previewText: "Set your password to get started",
      innerHtml: inner,
      primaryButton: { label: "Set your password", href: args.inviteLink },
      secondaryNote:
        "This link expires in 12 hours. For security, do not forward this email.",
    }),
  };
}

export function passwordResetEmail(args: { recipientName: string; resetLink: string }): {
  subject: string;
  htmlBody: string;
} {
  const inner = `
<p style="margin:0 0 16px">Hello ${escapeHtml(args.recipientName)},</p>
<p style="margin:0 0 16px">A coordinator asked you to set a new password for your ${escapeHtml(emailBrandName())} account.
Use the link below on this device’s browser to choose a new password.</p>
<p style="margin:0;font-size:14px;color:#64748b">If you did not expect this message, contact your coordinator.</p>`;

  return {
    subject: `Reset your password — ${emailBrandName()}`,
    htmlBody: wrapEmailLayout({
      headline: "Choose a new password",
      previewText: "Password reset for your workspace account",
      innerHtml: inner,
      primaryButton: { label: "Set new password", href: args.resetLink },
      secondaryNote: "This link expires in 12 hours.",
    }),
  };
}

export function smtpTestEmail(args: {
  recipientName: string;
  sentAtIso: string;
  appBaseUrl: string;
}): { subject: string; htmlBody: string } {
  const inner = `
<p style="margin:0 0 16px">Hello ${escapeHtml(args.recipientName)},</p>
<p style="margin:0 0 16px">This is a <strong>test message</strong> from ${escapeHtml(emailBrandName())}.
If you’re reading this, outbound mail (SMTP / SendGrid) is configured correctly.</p>
<p style="margin:0;font-size:13px;color:#64748b">
  Sent at ${escapeHtml(args.sentAtIso)}<br/>
  App URL: ${escapeHtml(args.appBaseUrl)}
</p>`;

  return {
    subject: `${emailBrandName()} — SMTP test`,
    htmlBody: wrapEmailLayout({
      headline: "Email delivery OK",
      previewText: "SMTP configuration verified",
      innerHtml: inner,
    }),
  };
}

export function jobRequestCreatedEmail(job: JobWithRelations): { subject: string; htmlBody: string } | null {
  const to = job.requesterEmail?.trim();
  if (!to) return null;

  const label = formatJobReference(job);
  const greet = job.requesterName?.trim()
    ? ` ${escapeHtml(job.requesterName.trim())}`
    : "";

  const detailsHtml = buildAssignmentDetailsTable(job, "requester");

  const inner = `
<p style="margin:0 0 16px">Hello${greet},</p>
<p style="margin:0 0 16px">Your request has been logged in ${escapeHtml(emailBrandName())}.</p>
<p style="margin:16px 0 8px;font-size:14px;font-weight:600;color:#0f172a">Request details</p>
${detailsHtml}
<p style="margin:16px 0 0;font-size:14px;color:#64748b">You’ll receive another email when an interpreter is assigned.</p>`;

  return {
    subject: `${label} created`,
    htmlBody: wrapEmailLayout({
      headline: "Request received",
      previewText: `${label} logged`,
      innerHtml: inner,
      secondaryNote:
        "This message was sent because your email is on file for this request. Contracting client contact details and your email address are not repeated in the message body.",
    }),
  };
}

export function jobRequestClaimedEmail(job: JobWithRelations): { subject: string; htmlBody: string } | null {
  const to = job.requesterEmail?.trim();
  if (!to) return null;

  const label = formatJobReference(job);
  const greet = job.requesterName?.trim()
    ? ` ${escapeHtml(job.requesterName.trim())}`
    : "";
  const interp = job.interpreter?.name ? escapeHtml(job.interpreter.name) : "An interpreter";

  const detailsHtml = buildAssignmentDetailsTable(job, "requester");

  const inner = `
<p style="margin:0 0 16px">Hello${greet},</p>
<p style="margin:0 0 16px"><strong>${interp}</strong> has been assigned.</p>
<p style="margin:16px 0 8px;font-size:14px;font-weight:600;color:#0f172a">Assignment details</p>
${detailsHtml}
<p style="margin:16px 0 0;font-size:14px;color:#64748b">We’ll follow up if anything changes.</p>`;

  return {
    subject: `${label} — ${job.interpreter?.name ?? "Linguist"} assigned`,
    htmlBody: wrapEmailLayout({
      headline: `${interp} has been assigned`,
      previewText: `${interp} assigned to your request`,
      innerHtml: inner,
      secondaryNote:
        "This message was sent because your email is on file for this request. Contracting client contact details and your email address are not repeated in the message body.",
    }),
  };
}

/** Open assignment broadcast to interpreters — claim / decline without signing in. */
export function jobPublishedInterpreterEmail(args: {
  interpreterName: string;
  job: JobWithRelations;
  claimUrl: string;
  declineUrl: string;
}): { subject: string; htmlBody: string } {
  const theme = emailTheme();
  const job = args.job;
  const label = formatJobReference(job);

  const detailsHtml = buildAssignmentDetailsTable(job, "interpreter_open");
  const previewWhen =
    job.serviceCategory === ServiceCategory.TRANSLATION
      ? job.translationDueDate
        ? new Date(job.translationDueDate).toLocaleString()
        : ""
      : `${new Date(job.startTime).toLocaleString()}`;
  const previewExtra = [job.language, previewWhen].filter(Boolean).join(" · ");

  const buttons = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;width:100%">
  <tr>
    <td align="center" style="padding:10px 8px">
      <a href="${escapeHtml(args.claimUrl)}" target="_blank" rel="noopener noreferrer"
        style="display:inline-block;padding:14px 28px;background:${theme.accent};color:#ffffff;font-family:system-ui,-apple-system,sans-serif;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px">
        Claim assignment
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:10px 8px">
      <a href="${escapeHtml(args.declineUrl)}" target="_blank" rel="noopener noreferrer"
        style="display:inline-block;padding:14px 28px;background:#ffffff;color:${theme.primary};border:2px solid ${theme.primary};font-family:system-ui,-apple-system,sans-serif;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px">
        Decline
      </a>
    </td>
  </tr>
</table>`;

  const inner = `
<p style="margin:0 0 16px">Hello ${escapeHtml(args.interpreterName)},</p>
<p style="margin:0 0 16px">A new open assignment matching <strong>${escapeHtml(job.language)}</strong> is available.
Open a link below to review the details, then confirm on the next page — <strong>no login required</strong>. Links are unique to you and expire in 7 days.</p>
<p style="margin:16px 0 8px;font-size:14px;font-weight:600;color:#0f172a">Appointment details</p>
${detailsHtml}
${buttons}
<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:${theme.muted}">If you decline, this assignment will stay open for other linguists. If you claim it first, it will be assigned to you.</p>`;

  return {
    subject: `New open assignment — ${label}`,
    htmlBody: wrapEmailLayout({
      headline: "New assignment published",
      previewText: `${label} — ${previewExtra}`,
      innerHtml: inner,
      secondaryNote:
        "Didn’t expect this? Contact your coordinator. Do not forward — links are tied to your account.",
    }),
  };
}

/** Upcoming assignment reminder for the assigned interpreter (driven by workspace reminder settings). */
export function interpreterAppointmentReminderEmail(args: {
  interpreterName: string;
  job: JobWithRelations;
  leadLabel: string;
  assignmentsUrl: string;
  jobDetailUrl: string;
}): { subject: string; htmlBody: string } {
  const job = args.job;
  const label = formatJobReference(job);
  const detailsHtml = buildAssignmentDetailsTable(job, "interpreter_open");
  const when = `${new Date(job.startTime).toLocaleString()} — ${new Date(job.endTime).toLocaleString()}`;

  const inner = `
<p style="margin:0 0 16px">Hello ${escapeHtml(args.interpreterName)},</p>
<p style="margin:0 0 16px">This is a scheduled reminder: your assignment <strong>${escapeHtml(label)}</strong>
starts in about <strong>${escapeHtml(args.leadLabel)}</strong> (${escapeHtml(when)}).</p>
<p style="margin:16px 0 8px;font-size:14px;font-weight:600;color:#0f172a">Assignment details</p>
${detailsHtml}
<p style="margin:16px 0 0;font-size:14px;color:#64748b">Open InterpreterHub to review notes, location, and any updates before you go.</p>`;

  return {
    subject: `Reminder: ${label} — ${args.leadLabel}`,
    htmlBody: wrapEmailLayout({
      headline: "Upcoming assignment",
      previewText: `${label} · ${args.leadLabel}`,
      innerHtml: inner,
      primaryButton: { label: "Open assignment", href: args.jobDetailUrl },
      secondaryNote: `You can also go to Assignments: ${escapeHtml(args.assignmentsUrl)}`,
    }),
  };
}
