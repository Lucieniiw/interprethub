import type { JobBillingStatus, JobOperationalStatus, Prisma } from "#prisma-client";

export type AppendJobEventInput = {
  jobId: number;
  eventType: string;
  payload?: Prisma.InputJsonValue;
  actorUserId?: number | null;
  previousOperationalStatus?: JobOperationalStatus | null;
  newOperationalStatus?: JobOperationalStatus | null;
  previousBillingStatus?: JobBillingStatus | null;
  newBillingStatus?: JobBillingStatus | null;
  correlationId?: string | null;
};

export function appendJobEvent(tx: Prisma.TransactionClient, input: AppendJobEventInput) {
  return tx.jobEvent.create({
    data: {
      jobId: input.jobId,
      eventType: input.eventType,
      payload: input.payload ?? {},
      actorUserId: input.actorUserId ?? undefined,
      previousOperationalStatus: input.previousOperationalStatus ?? undefined,
      newOperationalStatus: input.newOperationalStatus ?? undefined,
      previousBillingStatus: input.previousBillingStatus ?? undefined,
      newBillingStatus: input.newBillingStatus ?? undefined,
      correlationId: input.correlationId ?? undefined,
    },
  });
}
