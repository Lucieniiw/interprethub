import type {
  CompleteJobInterpreterInput,
  CreateJobInput,
  UpdateJobStaffInput,
} from "@interpret-hub/shared";
import {
  computeInterpretationPayBreakdown,
  computeTranslationPayBreakdown,
  formatJobReference,
  interpretationSessionMinDurationMessage,
  type InterpretationPayInput,
} from "@interpret-hub/shared";
import {
  CompletionStatus,
  InterpreterSessionOutcome,
  JobAssignmentState,
  JobBillingStatus,
  JobOfferStatus,
  JobOperationalStatus,
  JobStatus,
  Prisma,
  ServiceCategory,
  ServiceType,
  type UserRole,
} from "#prisma-client";
import { prisma } from "../lib/prisma.js";
import { decorateJobForClient } from "../lib/upload-response-decoration.js";
import * as activityService from "./activity.service.js";
import { allocateJobCode } from "../lib/job-code.js";
import * as jobEventService from "./job-event.service.js";
import * as jobRequesterEmail from "./job-requester-email.service.js";
import * as notificationsService from "./notifications.service.js";
import {
  type ScheduleConflict,
  findInterpreterScheduleConflicts,
} from "./scheduling-conflict.service.js";

/** Maps operational + billing lifecycle to legacy `JobStatus` for API compatibility. */
export function legacyJobStatusFromLifecycle(
  operational: JobOperationalStatus,
  billing: JobBillingStatus,
): JobStatus {
  if (billing === JobBillingStatus.PAID) return JobStatus.PAID;
  if (operational === JobOperationalStatus.CANCELLED) return JobStatus.CANCELLED;
  if (operational === JobOperationalStatus.COMPLETED) return JobStatus.COMPLETED;
  if (operational === JobOperationalStatus.UNDER_REVIEW) return JobStatus.COMPLETED;
  if (
    operational === JobOperationalStatus.ASSIGNED ||
    operational === JobOperationalStatus.IN_PROGRESS
  ) {
    return JobStatus.ASSIGNED;
  }
  return JobStatus.OPEN;
}

type JobWithClientInterpreter = Prisma.JobGetPayload<{
  include: {
    client: true;
    interpreter: { include: { interpreterProfile: true } };
  };
}>;

export type ClaimJobResult =
  | { ok: true; job: JobWithClientInterpreter }
  | { ok: false; code: "not_available" }
  | { ok: false; code: "schedule_conflict"; conflicts: ScheduleConflict[]; message: string };

export type { ScheduleConflict };

export async function listJobsForViewer(role: UserRole, viewerUserId: number) {
  const where: Prisma.JobWhereInput =
    role === "INTERPRETER"
      ? {
          OR: [
            {
              operationalStatus: JobOperationalStatus.OPEN,
              declines: { none: { interpreterId: viewerUserId } },
            },
            {
              operationalStatus: JobOperationalStatus.OFFERED,
              offers: { some: { interpreterId: viewerUserId, status: JobOfferStatus.PENDING } },
            },
            { interpreterId: viewerUserId },
          ],
        }
      : {};

  const rows = await prisma.job.findMany({
    where,
    orderBy: { startTime: "asc" },
    include: {
      client: true,
      interpreter: { select: { id: true, name: true, email: true } },
    },
    take: 500,
  });
  return rows.map((j) => toPublicJob(j, role));
}

/** Hides coordinator-only fields from interpreters (e.g. requester email, pay rates on nested profile). */
export function toPublicJob<J extends Record<string, unknown>>(job: J, role: UserRole): J {
  let out: Record<string, unknown>;
  if (role !== "INTERPRETER") {
    out = { ...(job as Record<string, unknown>) };
  } else {
    const { requesterEmail: _re, interpreter: rawInt, ...rest } = job as J & {
      requesterEmail?: unknown;
      interpreter?: unknown;
    };
    if (!rawInt || typeof rawInt !== "object") {
      out = { ...rest };
    } else {
      const { interpreterProfile: _prof, ...interpreter } = rawInt as Record<string, unknown>;
      out = { ...rest, interpreter };
    }
  }
  decorateJobForClient(out);
  return out as J;
}

export async function assertJobViewable(jobId: number, role: UserRole, userId: number): Promise<boolean> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return false;
  if (role !== "INTERPRETER") return true;
  if (job.interpreterId === userId) return true;
  if (job.operationalStatus === JobOperationalStatus.OPEN) {
    const d = await prisma.jobDecline.findUnique({
      where: { jobId_interpreterId: { jobId, interpreterId: userId } },
    });
    return !d;
  }
  if (job.operationalStatus === JobOperationalStatus.OFFERED) {
    const offer = await prisma.jobOffer.findFirst({
      where: { jobId, interpreterId: userId, status: JobOfferStatus.PENDING },
    });
    return !!offer;
  }
  return false;
}

export async function createJobFromPayload(d: CreateJobInput) {
  let startTime: Date;
  let endTime: Date;
  let translationDueDate: Date | undefined;

  if (d.serviceCategory === "TRANSLATION") {
    const due = new Date(d.translationDueDate!);
    translationDueDate = due;
    startTime = new Date(due);
    startTime.setHours(0, 0, 0, 0);
    endTime = new Date(due);
    endTime.setHours(23, 59, 59, 999);
  } else {
    startTime = new Date(d.startTime!);
    endTime = new Date(d.endTime!);
  }

  return prisma.$transaction(async (tx) => {
    const jobCode = await allocateJobCode(tx);
    const hasInterpreter = !!d.interpreterId;
    const operationalStatus = hasInterpreter ? JobOperationalStatus.ASSIGNED : JobOperationalStatus.OPEN;
    const billingStatus = JobBillingStatus.UNBILLED;
    const legacyStatus = legacyJobStatusFromLifecycle(operationalStatus, billingStatus);

    return tx.job.create({
      data: {
        jobCode,
        clientId: d.clientId ?? undefined,
        serviceCategory: d.serviceCategory as ServiceCategory,
        language: d.language,
        targetLanguage: d.targetLanguage ?? undefined,
        serviceType: (d.serviceCategory === "TRANSLATION" ? ServiceType.VIRTUAL : d.serviceType) as ServiceType,
        startTime,
        endTime,
        durationMinutes: d.durationMinutes ?? undefined,
        location: d.location ?? undefined,
        requesterEmail: d.requesterEmail ?? undefined,
        requesterName: d.requesterName ?? undefined,
        recipientName: d.recipientName ?? undefined,
        interpretationType:
          d.serviceCategory === "INTERPRETATION" ? (d.interpretationType ?? undefined) : undefined,
        translationDueDate: translationDueDate ?? undefined,
        translationClientName: d.translationClientName ?? undefined,
        rushFee: d.rushFee ?? undefined,
        notes: d.notes ?? undefined,
        interpreterId: d.interpreterId ?? undefined,
        rate: d.rate ?? 0,
        status: legacyStatus,
        operationalStatus,
        billingStatus,
        publishedAt: hasInterpreter ? undefined : new Date(),
        assignments: hasInterpreter
          ? {
              create: {
                interpreterId: d.interpreterId!,
                role: "PRIMARY",
                state: "CONFIRMED",
                plannedStartAt: startTime,
                plannedEndAt: endTime,
              },
            }
          : undefined,
      },
      include: { client: true, interpreter: { include: { interpreterProfile: true } } },
    });
  });
}

export async function getJobWithRelations(id: number) {
  return prisma.job.findUnique({
    where: { id },
    include: {
      client: true,
      interpreter: { include: { interpreterProfile: true } },
    },
  });
}

export async function attachFileToJob(jobId: number, publicPath: string) {
  return prisma.job.update({
    where: { id: jobId },
    data: { attachmentUrl: publicPath },
    include: { client: true, interpreter: { include: { interpreterProfile: true } } },
  });
}

export async function claimJob(jobId: number, interpreterId: number): Promise<ClaimJobResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM jobs WHERE id = ${jobId} FOR UPDATE`;

    const job = await tx.job.findUnique({ where: { id: jobId } });
    if (!job || job.operationalStatus !== JobOperationalStatus.OPEN) {
      return { ok: false as const, code: "not_available" as const };
    }

    const conflicts = await findInterpreterScheduleConflicts(
      {
        interpreterId,
        rangeStart: job.startTime,
        rangeEnd: job.endTime,
        excludeJobId: jobId,
      },
      tx,
    );
    if (conflicts.length > 0) {
      return {
        ok: false as const,
        code: "schedule_conflict" as const,
        conflicts,
        message: "This session overlaps another assignment or a busy block on your calendar.",
      };
    }

    const prevOp = job.operationalStatus;
    const prevBill = job.billingStatus;

    const updated = await tx.job.update({
      where: { id: jobId },
      data: {
        interpreterId,
        operationalStatus: JobOperationalStatus.ASSIGNED,
        status: JobStatus.ASSIGNED,
        assignments: {
          create: {
            interpreterId,
            role: "PRIMARY",
            state: "CONFIRMED",
            plannedStartAt: job.startTime,
            plannedEndAt: job.endTime,
          },
        },
      },
      include: { client: true, interpreter: { include: { interpreterProfile: true } } },
    });

    await jobEventService.appendJobEvent(tx, {
      jobId,
      eventType: "JOB_CLAIMED",
      actorUserId: interpreterId,
      previousOperationalStatus: prevOp,
      newOperationalStatus: updated.operationalStatus,
      previousBillingStatus: prevBill,
      newBillingStatus: updated.billingStatus,
    });

    const ref = formatJobReference({ id: jobId, jobCode: updated.jobCode });
    const linguist = updated.interpreter?.name ?? "Interpreter";
    await activityService.logActivity({
      type: "JOB_CLAIMED",
      message: `${ref}: ${linguist} assigned`,
      jobId,
      userId: interpreterId,
    });
    const admins = await tx.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: { id: true },
      take: 25,
    });
    for (const a of admins) {
      await notificationsService.createNotification(
        a.id,
        "JOB_CLAIMED",
        `${linguist} has been assigned to ${ref} (${updated.language}).`,
      );
    }
    await jobRequesterEmail.notifyRequesterJobClaimed(updated);
    return { ok: true as const, job: updated };
  });
}

export async function declineJob(jobId: number, interpreterId: number) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.operationalStatus !== JobOperationalStatus.OPEN) {
    return { ok: false as const, code: "not_open" as const };
  }
  await prisma.jobDecline.upsert({
    where: {
      jobId_interpreterId: { jobId, interpreterId },
    },
    create: { jobId, interpreterId },
    update: {},
  });
  await activityService.logActivity({
    type: "JOB_DECLINED",
    message: `Interpreter declined ${formatJobReference({ id: jobId, jobCode: job.jobCode })}`,
    jobId,
    userId: interpreterId,
  });
  return { ok: true as const };
}

function mapStaffPayload(d: UpdateJobStaffInput): Prisma.JobUpdateInput {
  const data: Prisma.JobUpdateInput = {};
  if (d.clientId !== undefined) data.client = d.clientId ? { connect: { id: d.clientId } } : { disconnect: true };
  if (d.serviceCategory !== undefined) data.serviceCategory = d.serviceCategory as ServiceCategory;
  if (d.language !== undefined) data.language = d.language;
  if (d.targetLanguage !== undefined) data.targetLanguage = d.targetLanguage;
  if (d.serviceType !== undefined) data.serviceType = d.serviceType as ServiceType;
  if (d.startTime !== undefined && d.startTime !== null) data.startTime = new Date(d.startTime);
  if (d.endTime !== undefined && d.endTime !== null) data.endTime = new Date(d.endTime);
  if (d.durationMinutes !== undefined) data.durationMinutes = d.durationMinutes ?? undefined;
  if (d.location !== undefined) data.location = d.location;
  if (d.requesterEmail !== undefined) data.requesterEmail = d.requesterEmail;
  if (d.requesterName !== undefined) data.requesterName = d.requesterName;
  if (d.recipientName !== undefined) data.recipientName = d.recipientName;
  if (d.interpretationType !== undefined) data.interpretationType = d.interpretationType;
  if (d.translationDueDate !== undefined) {
    data.translationDueDate = d.translationDueDate ? new Date(d.translationDueDate) : null;
  }
  if (d.translationClientName !== undefined) data.translationClientName = d.translationClientName;
  if (d.rushFee !== undefined) data.rushFee = d.rushFee;
  if (d.notes !== undefined) data.notes = d.notes;
  if (d.rate !== undefined) data.rate = d.rate ?? 0;
  if (d.interpreterId !== undefined) {
    data.interpreter = d.interpreterId ? { connect: { id: d.interpreterId } } : { disconnect: true };
    if (d.interpreterId && d.status === undefined) {
      data.status = JobStatus.ASSIGNED;
      data.operationalStatus = JobOperationalStatus.ASSIGNED;
    }
    if (d.interpreterId === null) {
      data.status = JobStatus.OPEN;
      data.operationalStatus = JobOperationalStatus.OPEN;
    }
  }
  if (d.status !== undefined) {
    const s = d.status as JobStatus;
    data.status = s;
    if (s === JobStatus.PAID) {
      data.billingStatus = JobBillingStatus.PAID;
      data.paidAt = new Date();
    }
    if (s === JobStatus.OPEN) {
      data.operationalStatus = JobOperationalStatus.OPEN;
    }
    if (s === JobStatus.ASSIGNED) {
      data.operationalStatus = JobOperationalStatus.ASSIGNED;
    }
    if (s === JobStatus.COMPLETED) {
      data.operationalStatus = JobOperationalStatus.COMPLETED;
    }
    if (s === JobStatus.CANCELLED) {
      data.operationalStatus = JobOperationalStatus.CANCELLED;
    }
  }
  if (d.completionStatus !== undefined) {
    data.completionStatus = d.completionStatus as CompletionStatus;
  }
  if (d.completionStatus === CompletionStatus.APPROVED) {
    data.completionDisputeNote = null;
  } else if (d.completionDisputeNote !== undefined) {
    const t = typeof d.completionDisputeNote === "string" ? d.completionDisputeNote.trim() : null;
    data.completionDisputeNote = t === "" || t == null ? null : t;
  }
  return data;
}

function staffPayloadKeys(payload: UpdateJobStaffInput): (keyof UpdateJobStaffInput)[] {
  return (Object.keys(payload) as (keyof UpdateJobStaffInput)[]).filter((k) => payload[k] !== undefined);
}

function assertStaffCanApplyPatch(
  existing: {
    operationalStatus: JobOperationalStatus;
    completionStatus: CompletionStatus;
    billingStatus: JobBillingStatus;
  },
  payload: UpdateJobStaffInput,
): { ok: true } | { ok: false; message: string } {
  const keys = staffPayloadKeys(payload);
  if (keys.length === 0) return { ok: true };

  if (existing.completionStatus === CompletionStatus.APPROVED) {
    const onlyMarkPaid =
      keys.length === 1 &&
      keys[0] === "status" &&
      payload.status === JobStatus.PAID &&
      existing.billingStatus !== JobBillingStatus.PAID;
    if (onlyMarkPaid) return { ok: true };
    return {
      ok: false,
      message:
        "This assignment is approved and locked. You may only mark it paid when billing has not already been finalized.",
    };
  }

  if (existing.completionStatus === CompletionStatus.PENDING_REVIEW) {
    const keys = staffPayloadKeys(payload);
    const allowedReviewKeys = new Set<keyof UpdateJobStaffInput>(["completionStatus", "completionDisputeNote"]);
    const foreign = keys.filter((k) => !allowedReviewKeys.has(k));
    if (foreign.length > 0) {
      return {
        ok: false,
        message:
          "A completion is waiting for review. Use Approve or Dispute only — assignment details stay read-only until then.",
      };
    }
    if (payload.completionStatus === undefined) {
      return {
        ok: false,
        message:
          "A completion is waiting for review. Use Approve or Dispute only — assignment details stay read-only until then.",
      };
    }
    if (payload.completionStatus === CompletionStatus.APPROVED) {
      if (
        payload.completionDisputeNote !== undefined &&
        payload.completionDisputeNote !== null &&
        String(payload.completionDisputeNote).trim() !== ""
      ) {
        return {
          ok: false,
          message: "When approving, omit the dispute note or send null — it is cleared automatically.",
        };
      }
      return { ok: true };
    }
    if (payload.completionStatus === CompletionStatus.DISPUTED) {
      return { ok: true };
    }
    return {
      ok: false,
      message:
        "Completion status may only change to approved or disputed from a pending linguist submission.",
    };
  }

  if (
    payload.completionStatus !== undefined &&
    payload.completionStatus !== existing.completionStatus
  ) {
    return {
      ok: false,
      message:
        "Completion status may only change to approved or disputed from a pending linguist submission.",
    };
  }

  const editable =
    existing.operationalStatus === JobOperationalStatus.OPEN ||
    existing.operationalStatus === JobOperationalStatus.ASSIGNED;
  if (!editable) {
    return {
      ok: false,
      message:
        "Coordinators may edit only jobs that are open or assigned (not in review, completed, or cancelled).",
    };
  }

  return { ok: true };
}

export async function syncEarningForJob(jobId: number) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { interpreter: { include: { interpreterProfile: true } } },
  });
  if (!job || !job.interpreterId) return;
  if (job.billingStatus === JobBillingStatus.PAID || job.status === JobStatus.PAID) {
    return;
  }
  const shouldSync =
    job.status === JobStatus.COMPLETED ||
    job.operationalStatus === JobOperationalStatus.COMPLETED ||
    job.operationalStatus === JobOperationalStatus.UNDER_REVIEW;
  if (!shouldSync) return;

  let billHours: number | null = null;
  let amount: number;
  let mileageAmount: number | null = null;
  let travelAmount: number | null = null;

  if (job.serviceCategory === ServiceCategory.TRANSLATION) {
    const t = computeTranslationPayBreakdown(job.rate, job.rushFee);
    amount = t.totalUsd;
  } else {
    const profileRow = job.interpreter?.interpreterProfile;
    const profile = profileRow
      ? {
          rateInPerson: profileRow.rateInPerson,
          rateVirtual: profileRow.rateVirtual,
          ratePhone: profileRow.ratePhone,
          rateMileage: profileRow.rateMileage,
          rateTravelTime: profileRow.rateTravelTime,
        }
      : null;

    const outcome =
      job.interpreterSessionOutcome === InterpreterSessionOutcome.LATE_CANCELLATION
        ? "LATE_CANCELLATION"
        : job.interpreterSessionOutcome === InterpreterSessionOutcome.COMPLETED_SESSION
          ? "COMPLETED_SESSION"
          : null;

    const payInput: InterpretationPayInput = {
      serviceType: job.serviceType as InterpretationPayInput["serviceType"],
      interpreterSessionOutcome: outcome,
      interpreterStartTime: job.interpreterStartTime,
      interpreterEndTime: job.interpreterEndTime,
      durationMinutes: job.durationMinutes,
      scheduledStartTime: job.startTime,
      scheduledEndTime: job.endTime,
      interpreterMileage: job.interpreterMileage,
      interpreterTravelTime: job.interpreterTravelTime,
      interpreterTravelOutsideCounty: job.interpreterTravelOutsideCounty,
    };

    const breakdown = computeInterpretationPayBreakdown(profile, payInput);
    amount = breakdown.totalUsd;
    billHours = breakdown.billableSessionHours;
    mileageAmount = breakdown.mileageUsd > 0 ? breakdown.mileageUsd : null;
    travelAmount = breakdown.travelUsd > 0 ? breakdown.travelUsd : null;
  }

  const existing = await prisma.earning.findFirst({ where: { jobId } });
  if (existing) {
    await prisma.earning.update({
      where: { id: existing.id },
      data: {
        amount,
        hours: billHours,
        mileageAmount,
        travelAmount,
        interpreterId: job.interpreterId,
        status: existing.status === "PAID" ? undefined : "PENDING",
      },
    });
  } else {
    await prisma.earning.create({
      data: {
        interpreterId: job.interpreterId,
        jobId,
        amount,
        hours: billHours,
        mileageAmount,
        travelAmount,
        status: "PENDING",
      },
    });
  }

  await notificationsService.createNotification(
    job.interpreterId,
    "EARNING_READY",
    `Earnings recorded for ${formatJobReference(job)} ($${amount.toFixed(2)}).`,
  );
}

/** When billing is finalized on the job, mirror that on the linguist earning row and notify. */
export async function finalizeEarningWhenJobMarkedPaid(
  jobId: number,
  interpreterId: number,
  jobCode: string | null,
) {
  const earning = await prisma.earning.findFirst({ where: { jobId } });
  const ref = formatJobReference({ id: jobId, jobCode });
  if (!earning) {
    console.warn(`[mark-paid] No earning row for ${ref}; linguist earnings list may be missing this job.`);
    return;
  }
  if (earning.status === "PAID") return;

  const paidAt = new Date();
  await prisma.earning.update({
    where: { id: earning.id },
    data: { status: "PAID", paidAt },
  });

  await notificationsService.createNotification(
    interpreterId,
    "EARNING_PAID",
    `Payment recorded for ${ref} ($${earning.amount.toFixed(2)}). See Earnings for details.`,
  );
}

export type UpdateJobByStaffResult =
  | { ok: true; job: NonNullable<Awaited<ReturnType<typeof getJobWithRelations>>> }
  | { ok: false; notFound: true }
  | { ok: false; conflict: true; message: string };

export async function updateJobByStaff(
  jobId: number,
  payload: UpdateJobStaffInput,
  actorId: number,
): Promise<UpdateJobByStaffResult> {
  const existing = await prisma.job.findUnique({ where: { id: jobId } });
  if (!existing) return { ok: false, notFound: true };

  const gate = assertStaffCanApplyPatch(existing, payload);
  if (!gate.ok) return { ok: false, conflict: true, message: gate.message };

  if (existing.serviceCategory === ServiceCategory.INTERPRETATION) {
    const startIso = payload.startTime ?? existing.startTime.toISOString();
    const endIso = payload.endTime ?? existing.endTime.toISOString();
    const svc = (payload.serviceType ?? existing.serviceType) as ServiceType;
    const st = Date.parse(startIso);
    const en = Date.parse(endIso);
    const durMsg = interpretationSessionMinDurationMessage(svc, st, en);
    if (durMsg) return { ok: false, conflict: true, message: durMsg };
  }

  const data = mapStaffPayload(payload);

  if (
    payload.completionStatus === CompletionStatus.APPROVED &&
    existing.completionStatus === CompletionStatus.PENDING_REVIEW
  ) {
    data.operationalStatus = JobOperationalStatus.COMPLETED;
  }
  if (
    payload.completionStatus === CompletionStatus.DISPUTED &&
    existing.completionStatus !== CompletionStatus.DISPUTED
  ) {
    data.operationalStatus = JobOperationalStatus.ASSIGNED;
  }

  const nextOp = (data.operationalStatus ?? existing.operationalStatus) as JobOperationalStatus;
  const nextBill = (data.billingStatus ?? existing.billingStatus) as JobBillingStatus;
  data.status = legacyJobStatusFromLifecycle(nextOp, nextBill);

  const updated = await prisma.job.update({
    where: { id: jobId },
    data,
    include: { client: true, interpreter: { include: { interpreterProfile: true } } },
  });

  if (
    payload.interpreterId !== undefined ||
    payload.startTime !== undefined ||
    payload.endTime !== undefined
  ) {
    if (updated.interpreterId == null) {
      await prisma.jobAssignment.updateMany({
        where: { jobId, state: { not: JobAssignmentState.RELEASED } },
        data: { state: JobAssignmentState.RELEASED },
      });
    } else if (existing.interpreterId !== updated.interpreterId) {
      await prisma.jobAssignment.updateMany({
        where: { jobId, state: { not: JobAssignmentState.RELEASED } },
        data: { state: JobAssignmentState.RELEASED },
      });
      await prisma.jobAssignment.create({
        data: {
          jobId,
          interpreterId: updated.interpreterId,
          role: "PRIMARY",
          state: "CONFIRMED",
          plannedStartAt: updated.startTime,
          plannedEndAt: updated.endTime,
        },
      });
    } else {
      const n = await prisma.jobAssignment.updateMany({
        where: {
          jobId,
          interpreterId: updated.interpreterId,
          state: JobAssignmentState.CONFIRMED,
        },
        data: {
          plannedStartAt: updated.startTime,
          plannedEndAt: updated.endTime,
        },
      });
      if (n.count === 0) {
        await prisma.jobAssignment.create({
          data: {
            jobId,
            interpreterId: updated.interpreterId,
            role: "PRIMARY",
            state: "CONFIRMED",
            plannedStartAt: updated.startTime,
            plannedEndAt: updated.endTime,
          },
        });
      }
    }
  }

  if (
    payload.completionStatus === CompletionStatus.APPROVED &&
    existing.completionStatus === CompletionStatus.PENDING_REVIEW
  ) {
    await jobEventService.appendJobEvent(prisma, {
      jobId,
      eventType: "COMPLETION_APPROVED",
      actorUserId: actorId,
      previousOperationalStatus: existing.operationalStatus,
      newOperationalStatus: updated.operationalStatus,
      previousBillingStatus: existing.billingStatus,
      newBillingStatus: updated.billingStatus,
    });
  }

  if (
    payload.completionStatus === CompletionStatus.DISPUTED &&
    existing.completionStatus !== CompletionStatus.DISPUTED &&
    updated.interpreterId
  ) {
    await jobEventService.appendJobEvent(prisma, {
      jobId,
      eventType: "COMPLETION_DISPUTED",
      actorUserId: actorId,
      previousOperationalStatus: existing.operationalStatus,
      newOperationalStatus: updated.operationalStatus,
      previousBillingStatus: existing.billingStatus,
      newBillingStatus: updated.billingStatus,
    });
    const ref = formatJobReference({ id: jobId, jobCode: updated.jobCode });
    const note = (updated.completionDisputeNote ?? "").trim();
    const suffix = note ? ` Coordinator note: ${note.length > 280 ? `${note.slice(0, 277)}…` : note}` : "";
    await notificationsService.createNotification(
      updated.interpreterId,
      "COMPLETION_DISPUTED",
      `Your completion for ${ref} was disputed — open the assignment, update the form, and submit again.${suffix}`,
    );
  }

  await activityService.logActivity({
    type: "JOB_UPDATED",
    message: `Staff updated ${formatJobReference({ id: jobId, jobCode: updated.jobCode })}`,
    jobId,
    userId: actorId,
  });

  const becamePaid =
    updated.billingStatus === JobBillingStatus.PAID &&
    existing.billingStatus !== JobBillingStatus.PAID;
  if (becamePaid && updated.interpreterId) {
    await finalizeEarningWhenJobMarkedPaid(jobId, updated.interpreterId, updated.jobCode ?? null);
  }

  if (
    updated.status === JobStatus.COMPLETED ||
    updated.operationalStatus === JobOperationalStatus.COMPLETED ||
    updated.operationalStatus === JobOperationalStatus.UNDER_REVIEW
  ) {
    await syncEarningForJob(jobId);
  }

  const row = await prisma.job.findUnique({
    where: { id: jobId },
    include: { client: true, interpreter: { include: { interpreterProfile: true } } },
  });
  if (!row) return { ok: false, notFound: true };
  return { ok: true, job: row };
}

export async function completeJobByInterpreter(
  jobId: number,
  interpreterId: number,
  payload: CompleteJobInterpreterInput,
): Promise<
  | {
      ok: true;
      job: NonNullable<Awaited<ReturnType<typeof getJobWithRelations>>>;
    }
  | { ok: false; code: "forbidden" }
  | { ok: false; code: "invalid_status"; message: string }
  | { ok: false; code: "validation"; message: string }
> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { interpreter: { select: { id: true, name: true } } },
  });
  if (!job || job.interpreterId !== interpreterId) {
    return { ok: false as const, code: "forbidden" as const };
  }

  const submissionLocked =
    job.completionStatus === CompletionStatus.PENDING_REVIEW ||
    job.completionStatus === CompletionStatus.APPROVED;
  if (submissionLocked) {
    return {
      ok: false as const,
      code: "validation" as const,
      message:
        "This completion was already submitted and is awaiting coordinator review. You can edit again only if the coordinator disputes it.",
    };
  }

  const isInterpretation = job.serviceCategory === ServiceCategory.INTERPRETATION;

  if (payload.markCompleted) {
    const resubmitAfterDispute = job.completionStatus === CompletionStatus.DISPUTED;
    if (!resubmitAfterDispute) {
      const activeAssignment =
        job.status === JobStatus.ASSIGNED ||
        job.operationalStatus === JobOperationalStatus.ASSIGNED ||
        job.operationalStatus === JobOperationalStatus.IN_PROGRESS;
      if (!activeAssignment) {
        return {
          ok: false as const,
          code: "invalid_status" as const,
          message: "Only active assignments can be submitted.",
        };
      }
    } else if (
      job.status !== JobStatus.COMPLETED &&
      job.status !== JobStatus.CANCELLED &&
      job.operationalStatus !== JobOperationalStatus.UNDER_REVIEW &&
      job.operationalStatus !== JobOperationalStatus.ASSIGNED
    ) {
      return {
        ok: false as const,
        code: "invalid_status" as const,
        message: "This assignment cannot be resubmitted from its current state.",
      };
    }
    const paidEarning = await prisma.earning.findFirst({
      where: { jobId, status: "PAID" },
    });
    if (paidEarning || job.billingStatus === JobBillingStatus.PAID) {
      return {
        ok: false as const,
        code: "validation" as const,
        message: "This job is already paid and cannot be updated.",
      };
    }

    if (isInterpretation) {
      if (!payload.sessionOutcome) {
        return {
          ok: false as const,
          code: "validation" as const,
          message: "Select whether the session was completed or a late cancellation.",
        };
      }
      if (!payload.staffName?.trim()) {
        return {
          ok: false as const,
          code: "validation" as const,
          message: "Staff name is required.",
        };
      }
      if (!payload.staffSignature?.trim()) {
        return {
          ok: false as const,
          code: "validation" as const,
          message: "Staff signature is required.",
        };
      }
      if (!payload.interpreterSignature?.trim()) {
        return {
          ok: false as const,
          code: "validation" as const,
          message: "Interpreter signature is required.",
        };
      }

      const travelOutside = payload.travelOutsideCounty === true;
      if (!travelOutside && payload.interpreterTravelTime != null && payload.interpreterTravelTime > 0) {
        return {
          ok: false as const,
          code: "validation" as const,
          message: "Travel time applies only when you traveled outside your residential county.",
        };
      }

      if (payload.sessionOutcome === "COMPLETED_SESSION") {
        if (!payload.interpreterStartTime || !payload.interpreterEndTime) {
          return {
            ok: false as const,
            code: "validation" as const,
            message: "Session start and end are required for a completed session.",
          };
        }
        const st = new Date(payload.interpreterStartTime).getTime();
        const en = new Date(payload.interpreterEndTime).getTime();
        if (!(en > st)) {
          return {
            ok: false as const,
            code: "validation" as const,
            message: "Session end must be after session start.",
          };
        }
        const hours = (en - st) / 3600000;
        if (hours < 2) {
          return {
            ok: false as const,
            code: "validation" as const,
            message: "Billable session must be at least 2 hours.",
          };
        }
      }
    }
  }

  const travelBill = payload.interpreterTravelTime;
  if (travelBill != null && travelBill > 0 && travelBill < 60) {
    return {
      ok: false as const,
      code: "validation" as const,
      message: "Travel time must be at least 1 hour when provided.",
    };
  }

  const data: Prisma.JobUpdateInput = {};
  if (payload.completionStatus !== undefined) {
    data.completionStatus = payload.completionStatus as CompletionStatus;
  }
  if (payload.completionNotes !== undefined) data.completionNotes = payload.completionNotes;
  if (payload.interpreterStartTime !== undefined) {
    data.interpreterStartTime = payload.interpreterStartTime ? new Date(payload.interpreterStartTime) : null;
  }
  if (payload.interpreterEndTime !== undefined) {
    data.interpreterEndTime = payload.interpreterEndTime ? new Date(payload.interpreterEndTime) : null;
  }
  if (payload.interpreterMileage !== undefined) data.interpreterMileage = payload.interpreterMileage;
  if (payload.interpreterNotes !== undefined) data.interpreterNotes = payload.interpreterNotes;
  if (payload.interpreterSignature !== undefined) data.interpreterSignature = payload.interpreterSignature;
  if (payload.staffName !== undefined) data.staffName = payload.staffName;
  if (payload.staffSignature !== undefined) data.staffSignature = payload.staffSignature;

  if (payload.travelOutsideCounty !== undefined) {
    data.interpreterTravelOutsideCounty = payload.travelOutsideCounty;
  }

  if (payload.interpreterTravelTime !== undefined) {
    data.interpreterTravelTime =
      payload.travelOutsideCounty === false ? null : payload.interpreterTravelTime;
  } else if (payload.travelOutsideCounty === false) {
    data.interpreterTravelTime = null;
  }

  if (payload.sessionOutcome !== undefined && isInterpretation) {
    data.interpreterSessionOutcome = payload.sessionOutcome as InterpreterSessionOutcome;
  }

  if (payload.markCompleted) {
    if (!isInterpretation) {
      data.status = JobStatus.COMPLETED;
      data.operationalStatus = JobOperationalStatus.UNDER_REVIEW;
      if (!payload.completionStatus) {
        data.completionStatus = CompletionStatus.PENDING_REVIEW;
      }
    } else if (payload.sessionOutcome === "LATE_CANCELLATION") {
      data.status = JobStatus.CANCELLED;
      data.operationalStatus = JobOperationalStatus.CANCELLED;
      data.interpreterSessionOutcome = InterpreterSessionOutcome.LATE_CANCELLATION;
      if (!payload.completionStatus) {
        data.completionStatus = CompletionStatus.PENDING_REVIEW;
      }
    } else if (payload.sessionOutcome === "COMPLETED_SESSION") {
      data.status = JobStatus.COMPLETED;
      data.operationalStatus = JobOperationalStatus.UNDER_REVIEW;
      data.interpreterSessionOutcome = InterpreterSessionOutcome.COMPLETED_SESSION;
      if (!payload.completionStatus) {
        data.completionStatus = CompletionStatus.PENDING_REVIEW;
      }
    }
  }

  await prisma.job.update({
    where: { id: jobId },
    data,
  });

  if (payload.markCompleted) {
    const row = await prisma.job.findUnique({ where: { id: jobId } });
    if (row) {
      await jobEventService.appendJobEvent(prisma, {
        jobId,
        eventType: "INTERPRETER_COMPLETION_SUBMITTED",
        actorUserId: interpreterId,
        previousOperationalStatus: job.operationalStatus,
        newOperationalStatus: row.operationalStatus,
        previousBillingStatus: job.billingStatus,
        newBillingStatus: row.billingStatus,
      });
    }
  }

  if (payload.markCompleted) {
    if (isInterpretation && payload.sessionOutcome === "LATE_CANCELLATION") {
      await prisma.earning.deleteMany({
        where: { jobId, status: "PENDING" },
      });
      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
        select: { id: true },
        take: 25,
      });
      const ref = formatJobReference({ id: jobId, jobCode: job.jobCode });
      for (const a of admins) {
        await notificationsService.createNotification(
          a.id,
          "COMPLETION_PENDING_REVIEW",
          `${job.interpreter?.name ?? "Interpreter"} submitted a late cancellation for ${ref} — review in Assignments → Submissions.`,
        );
      }
    } else {
      await syncEarningForJob(jobId);
      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
        select: { id: true },
        take: 25,
      });
      const ref = formatJobReference({ id: jobId, jobCode: job.jobCode });
      const linguist = job.interpreter?.name ?? "Interpreter";
      for (const a of admins) {
        await notificationsService.createNotification(
          a.id,
          "COMPLETION_PENDING_REVIEW",
          `${linguist} submitted completion for ${ref} (${job.language}). Review in Assignments → Submissions.`,
        );
      }
    }
  }

  const activityMessage =
    payload.markCompleted && isInterpretation && payload.sessionOutcome === "LATE_CANCELLATION"
      ? `Interpreter reported late cancellation for ${formatJobReference({ id: jobId, jobCode: job.jobCode })}`
      : payload.markCompleted
        ? `Interpreter submitted completion for ${formatJobReference({ id: jobId, jobCode: job.jobCode })}`
        : `Interpreter saved completion draft for ${formatJobReference({ id: jobId, jobCode: job.jobCode })}`;

  await activityService.logActivity({
    type: "JOB_COMPLETION_SAVED",
    message: activityMessage,
    jobId,
    userId: interpreterId,
  });

  const nextJob = await getJobWithRelations(jobId);
  if (!nextJob) {
    return {
      ok: false as const,
      code: "validation" as const,
      message: "Job could not be reloaded after update.",
    };
  }

  return { ok: true as const, job: nextJob };
}

export async function listJobEventsForJob(jobId: number, limit = 200) {
  return prisma.jobEvent.findMany({
    where: { jobId },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      actor: { select: { id: true, name: true, email: true, role: true } },
    },
  });
}
