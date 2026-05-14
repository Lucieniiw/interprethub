import {
  formatJobReference,
  REMINDER_LEAD_TIME_OPTIONS,
  type ReminderLeadMinutes,
  type WorkspaceNotificationPreferences,
} from "@interpret-hub/shared";
import { JobOperationalStatus, ServiceCategory } from "#prisma-client";
import { interpreterAppointmentReminderEmail } from "../lib/email-templates/transactional.js";
import { sendMailWithJuice } from "../lib/mailer.js";
import { publicBrowserOrigin } from "../lib/public-url.js";
import { prisma } from "../lib/prisma.js";
import * as jobEventService from "./job-event.service.js";
import * as notificationsService from "./notifications.service.js";
import { getWorkspaceNotificationPreferences } from "./workspace-notification-prefs.service.js";

const REMINDER_EVENT = "APPOINTMENT_REMINDER";

/** Wider than the scheduler interval so a missed tick still sends once. */
const SEND_WINDOW_MS = 28 * 60 * 1000;

const DEFAULT_SCAN_HORIZON_MS = 14 * 24 * 60 * 60 * 1000;

type ReminderChannel = "email" | "in_app";

function leadLabel(minutes: ReminderLeadMinutes): string {
  return REMINDER_LEAD_TIME_OPTIONS.find((o) => o.minutes === minutes)?.label ?? `${minutes} minutes`;
}

function reminderSentInPayloads(
  payloads: Array<{ payload: unknown }>,
  leadMinutes: number,
  channel: ReminderChannel,
): boolean {
  return payloads.some((e) => {
    const p = e.payload as { leadMinutes?: unknown; channel?: unknown };
    return p.leadMinutes === leadMinutes && p.channel === channel;
  });
}

function isInSendWindow(nowMs: number, startMs: number, leadMinutes: number): boolean {
  const targetMs = startMs - leadMinutes * 60_000;
  return nowMs >= targetMs && nowMs < targetMs + SEND_WINDOW_MS && nowMs < startMs;
}

async function recordReminderSent(jobId: number, leadMinutes: number, channel: ReminderChannel) {
  await jobEventService.appendJobEvent(prisma, {
    jobId,
    eventType: REMINDER_EVENT,
    payload: { leadMinutes, channel, v: 1 },
  });
}

export type DispatchAppointmentRemindersResult = {
  jobsConsidered: number;
  emailsSent: number;
  inAppSent: number;
};

let warnedReminderEmailWithoutSmtp = false;

export async function dispatchAppointmentReminders(): Promise<DispatchAppointmentRemindersResult> {
  const result: DispatchAppointmentRemindersResult = {
    jobsConsidered: 0,
    emailsSent: 0,
    inAppSent: 0,
  };

  let prefs: WorkspaceNotificationPreferences;
  try {
    prefs = await getWorkspaceNotificationPreferences();
  } catch (e) {
    console.error("[reminders] failed to load notification preferences", e);
    return result;
  }

  const leads = prefs.reminder.reminderLeadTimesMinutes;
  if (leads.length === 0) return result;
  if (!prefs.reminder.email && !prefs.reminder.inApp) return result;

  const smtpReady = Boolean(process.env.SMTP_HOST?.trim());
  if (prefs.reminder.email && !smtpReady && !warnedReminderEmailWithoutSmtp) {
    warnedReminderEmailWithoutSmtp = true;
    console.warn("[reminders] reminder email is on in settings but SMTP_HOST is not set; email reminders skipped");
  }

  const now = new Date();
  const nowMs = now.getTime();
  const horizon = new Date(nowMs + DEFAULT_SCAN_HORIZON_MS);

  const jobs = await prisma.job.findMany({
    where: {
      serviceCategory: ServiceCategory.INTERPRETATION,
      interpreterId: { not: null },
      operationalStatus: { in: [JobOperationalStatus.ASSIGNED, JobOperationalStatus.IN_PROGRESS] },
      startTime: { gt: now, lt: horizon },
    },
    include: { client: true, interpreter: { select: { id: true, name: true, email: true } } },
    take: 500,
    orderBy: { startTime: "asc" },
  });

  const baseUrl = publicBrowserOrigin();
  const assignmentsUrl = `${baseUrl}/assignments`;

  for (const job of jobs) {
    result.jobsConsidered += 1;
    const interpreterId = job.interpreterId;
    if (!interpreterId) continue;

    const reminderPayloads = await prisma.jobEvent.findMany({
      where: { jobId: job.id, eventType: REMINDER_EVENT },
      select: { payload: true },
      take: 120,
    });

    const startMs = job.startTime.getTime();

    for (const leadMinutes of leads) {
      if (!isInSendWindow(nowMs, startMs, leadMinutes)) continue;

      const label = leadLabel(leadMinutes as ReminderLeadMinutes);

      if (prefs.reminder.email && smtpReady) {
        const email = job.interpreter?.email?.trim();
        if (
          email &&
          !reminderSentInPayloads(reminderPayloads, leadMinutes, "email")
        ) {
          try {
            const { subject, htmlBody } = interpreterAppointmentReminderEmail({
              interpreterName: job.interpreter?.name ?? "there",
              job,
              leadLabel: label,
              assignmentsUrl,
              jobDetailUrl: `${baseUrl}/jobs/${job.id}`,
            });
            await sendMailWithJuice({ to: email, subject, htmlBody });
            await recordReminderSent(job.id, leadMinutes, "email");
            reminderPayloads.push({
              payload: { leadMinutes, channel: "email" as const, v: 1 },
            });
            result.emailsSent += 1;
          } catch (err) {
            console.error(`[reminders] email failed jobId=${job.id} lead=${leadMinutes}`, err);
          }
        }
      }

      if (
        prefs.reminder.inApp &&
        !reminderSentInPayloads(reminderPayloads, leadMinutes, "in_app")
      ) {
        const ref = formatJobReference(job);
        try {
          await notificationsService.createNotification(
            interpreterId,
            "APPOINTMENT_REMINDER",
            `Reminder (${label}): ${ref} (${job.language}) starts ${new Date(job.startTime).toLocaleString()}.`,
          );
          await recordReminderSent(job.id, leadMinutes, "in_app");
          reminderPayloads.push({
            payload: { leadMinutes, channel: "in_app" as const, v: 1 },
          });
          result.inAppSent += 1;
        } catch (err) {
          console.error(`[reminders] in-app failed jobId=${job.id} lead=${leadMinutes}`, err);
        }
      }
    }
  }

  if (result.emailsSent > 0 || result.inAppSent > 0) {
    console.log(
      `[reminders] tick: jobs=${result.jobsConsidered} emails=${result.emailsSent} inApp=${result.inAppSent}`,
    );
  }

  return result;
}

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export function startReminderDispatchScheduler(): void {
  if (process.env.DISABLE_REMINDER_DISPATCH === "1" || process.env.NODE_ENV === "test") return;

  const raw = process.env.REMINDER_DISPATCH_INTERVAL_MS;
  const interval = raw === undefined || raw === "" ? DEFAULT_INTERVAL_MS : Number(raw);
  if (!Number.isFinite(interval) || interval < 60_000) {
    console.warn(
      `[reminders] REMINDER_DISPATCH_INTERVAL_MS invalid or <60000 (${raw}); using ${DEFAULT_INTERVAL_MS}ms`,
    );
  }
  const ms = !Number.isFinite(interval) || interval < 60_000 ? DEFAULT_INTERVAL_MS : interval;

  const tick = () => {
    void dispatchAppointmentReminders();
  };
  setTimeout(tick, 20_000);
  setInterval(tick, ms);
  console.log(`[reminders] scheduler every ${ms}ms (set DISABLE_REMINDER_DISPATCH=1 to turn off)`);
}
