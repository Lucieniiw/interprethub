import type { Client, Job, User } from "#prisma-client";
import {
  jobRequestClaimedEmail,
  jobRequestCreatedEmail,
} from "../lib/email-templates/index.js";
import { sendMailWithJuice } from "../lib/mailer.js";

type JobWithRelations = Job & {
  client?: Client | null;
  interpreter?: Pick<User, "id" | "name" | "email"> | null;
};

export async function notifyRequesterJobCreated(job: JobWithRelations): Promise<void> {
  const built = jobRequestCreatedEmail(job);
  if (!built) return;

  const to = job.requesterEmail!.trim();
  await sendMailWithJuice({
    to,
    subject: built.subject,
    htmlBody: built.htmlBody,
  });
}

export async function notifyRequesterJobClaimed(job: JobWithRelations): Promise<void> {
  const built = jobRequestClaimedEmail(job);
  if (!built) return;

  const to = job.requesterEmail!.trim();
  await sendMailWithJuice({
    to,
    subject: built.subject,
    htmlBody: built.htmlBody,
  });
}
