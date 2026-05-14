import type { Prisma } from "#prisma-client";
import { JobAssignmentState, JobOperationalStatus } from "#prisma-client";
import { prisma } from "../lib/prisma.js";

export type ScheduleConflict =
  | {
      kind: "assignment";
      jobId: number;
      jobCode: string | null;
      plannedStartAt: Date;
      plannedEndAt: Date;
    }
  | {
      kind: "busy";
      slotId: number;
      startTime: Date;
      endTime: Date;
      reason: string | null;
    };

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Returns scheduling overlaps for an interpreter: active assignments (non-released jobs)
 * and busy slots. Excludes `excludeJobId` when checking assignment rows for that job.
 */
export async function findInterpreterScheduleConflicts(
  params: {
    interpreterId: number;
    rangeStart: Date;
    rangeEnd: Date;
    excludeJobId?: number;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<ScheduleConflict[]> {
  const { interpreterId, rangeStart, rangeEnd, excludeJobId } = params;
  const conflicts: ScheduleConflict[] = [];

  const assignments = await db.jobAssignment.findMany({
    where: {
      interpreterId,
      state: { not: JobAssignmentState.RELEASED },
      job: {
        operationalStatus: { notIn: [JobOperationalStatus.CANCELLED] },
        ...(excludeJobId ? { id: { not: excludeJobId } } : {}),
      },
    },
    include: {
      job: { select: { id: true, jobCode: true } },
    },
  });

  for (const a of assignments) {
    if (rangesOverlap(rangeStart, rangeEnd, a.plannedStartAt, a.plannedEndAt)) {
      conflicts.push({
        kind: "assignment",
        jobId: a.job.id,
        jobCode: a.job.jobCode,
        plannedStartAt: a.plannedStartAt,
        plannedEndAt: a.plannedEndAt,
      });
    }
  }

  const busy = await db.busySlot.findMany({
    where: {
      interpreterId,
      startTime: { lt: rangeEnd },
      endTime: { gt: rangeStart },
    },
  });

  for (const b of busy) {
    if (rangesOverlap(rangeStart, rangeEnd, b.startTime, b.endTime)) {
      conflicts.push({
        kind: "busy",
        slotId: b.id,
        startTime: b.startTime,
        endTime: b.endTime,
        reason: b.reason,
      });
    }
  }

  return conflicts;
}
