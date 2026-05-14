import { InterpreterStatus, UserRole, type Client, type Job } from "#prisma-client";
import { jobPublishedInterpreterEmail } from "../lib/email-templates/transactional.js";
import { signJobActionToken } from "../lib/jwt.js";
import { sendMailWithJuice } from "../lib/mailer.js";
import { publicBrowserOrigin } from "../lib/public-url.js";
import { prisma } from "../lib/prisma.js";

type JobWithClient = Job & { client?: Client | null };

function buildMagicLink(jobId: number, interpreterId: number, act: "claim" | "decline"): string {
  const token = signJobActionToken({ jobId, interpreterId, act });
  const base = publicBrowserOrigin();
  return `${base}/api/jobs/email-action?token=${encodeURIComponent(token)}`;
}

export function interpreterMatchesJobLanguage(userLanguages: string[], jobLanguage: string): boolean {
  const j = jobLanguage.trim().toLowerCase();
  if (!j) return false;
  if (userLanguages.length === 0) return false;
  return userLanguages.some((l) => l.trim().toLowerCase() === j);
}

/** Email each ACTIVE interpreter whose languages include this job’s language (case-insensitive). */
export async function notifyInterpretersJobPublished(job: JobWithClient): Promise<void> {
  if (!process.env.SMTP_HOST?.trim()) return;
  if (job.status !== "OPEN") return;

  const interpreters = await prisma.user.findMany({
    where: {
      role: UserRole.INTERPRETER,
      accountLocked: false,
      interpreterStatus: InterpreterStatus.ACTIVE,
    },
    select: { id: true, name: true, email: true, languages: true },
  });

  const matched = interpreters.filter((u) => interpreterMatchesJobLanguage(u.languages, job.language));

  if (matched.length === 0) {
    console.warn(
      `[job-published-email] No ACTIVE interpreters matched language "${job.language}". Check team language lists.`,
    );
    return;
  }

  const ids = matched.map((u) => u.id);
  const blockingSlots = await prisma.busySlot.findMany({
    where: {
      interpreterId: { in: ids },
      startTime: { lt: job.endTime },
      endTime: { gt: job.startTime },
    },
    select: { interpreterId: true },
  });
  const blockedIds = new Set(blockingSlots.map((b) => b.interpreterId));
  const eligible = matched.filter((u) => !blockedIds.has(u.id));

  if (eligible.length === 0) {
    console.warn(
      `[job-published-email] All ${matched.length} language-matched interpreter(s) have busy/unavailable time overlapping this job; no broadcast emails sent.`,
    );
    return;
  }

  for (const u of eligible) {
    const email = u.email?.trim();
    if (!email) continue;

    try {
      const claimUrl = buildMagicLink(job.id, u.id, "claim");
      const declineUrl = buildMagicLink(job.id, u.id, "decline");
      const { subject, htmlBody } = jobPublishedInterpreterEmail({
        interpreterName: u.name,
        job,
        claimUrl,
        declineUrl,
      });
      await sendMailWithJuice({ to: email, subject, htmlBody });
    } catch (err) {
      console.error(`[job-published-email] failed for interpreter id=${u.id}`, err);
    }
  }
}
