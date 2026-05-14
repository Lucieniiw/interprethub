import {
  CompletionStatus,
  InterpreterSessionOutcome,
  JobBillingStatus,
  JobOperationalStatus,
  JobStatus,
} from "#prisma-client";
import type { Prisma } from "#prisma-client";
import { prisma } from "../lib/prisma.js";

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;
export const REPORT_EXPORT_MAX_ROWS = 10_000;

function assertValidRange(start: Date, end: Date) {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Invalid dates.");
  }
  if (start > end) {
    throw new Error("startTimeMin must be before startTimeMax.");
  }
  if (end.getTime() - start.getTime() > MAX_RANGE_MS) {
    throw new Error("Date range cannot exceed 366 days.");
  }
}

/** Rows included in invoice/bill/lead exports (excludes plain cancellations). */
function exportableJobWhere(range: Prisma.DateTimeFilter): Prisma.JobWhereInput {
  return {
    startTime: range,
    OR: [
      { operationalStatus: { not: JobOperationalStatus.CANCELLED } },
      {
        operationalStatus: JobOperationalStatus.CANCELLED,
        interpreterSessionOutcome: InterpreterSessionOutcome.LATE_CANCELLATION,
        completionStatus: CompletionStatus.APPROVED,
      },
    ],
  };
}

export async function getStaffExportBundle(start: Date, end: Date) {
  assertValidRange(start, end);

  const range: Prisma.DateTimeFilter = { gte: start, lte: end };
  const exportWhere = exportableJobWhere(range);

  const pendingReviewUnpaidWhere: Prisma.JobWhereInput = {
    startTime: range,
    completionStatus: CompletionStatus.PENDING_REVIEW,
    billingStatus: { not: JobBillingStatus.PAID },
    status: { not: JobStatus.PAID },
  };

  const [jobs, pendingReviewUnpaidCount] = await Promise.all([
    prisma.job.findMany({
      where: exportWhere,
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        jobCode: true,
        language: true,
        targetLanguage: true,
        serviceCategory: true,
        serviceType: true,
        startTime: true,
        endTime: true,
        durationMinutes: true,
        recipientName: true,
        patientName: true,
        translationClientName: true,
        requesterName: true,
        interpreterMileage: true,
        interpreterTravelTime: true,
        interpreterTravelOutsideCounty: true,
        location: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            organization: true,
            industry: true,
            address: true,
            rateInPerson: true,
            ratePhone: true,
            rateVirtual: true,
            rateMileage: true,
            rateTravelTime: true,
          },
        },
        interpreter: {
          select: {
            id: true,
            name: true,
            email: true,
            interpreterProfile: {
              select: {
                rateInPerson: true,
                rateVirtual: true,
                ratePhone: true,
                rateMileage: true,
                rateTravelTime: true,
              },
            },
          },
        },
      },
      take: REPORT_EXPORT_MAX_ROWS,
    }),
    prisma.job.count({ where: pendingReviewUnpaidWhere }),
  ]);

  return {
    jobs,
    truncated: jobs.length >= REPORT_EXPORT_MAX_ROWS,
    pendingReviewUnpaidCount,
  };
}