import type { PatchEarningStaffInput } from "@interpret-hub/shared";
import { formatJobReference, parseLinguistPaydays, nextPaydayOnOrAfter } from "@interpret-hub/shared";
import type { UserRole } from "#prisma-client";
import { prisma } from "../lib/prisma.js";
import * as notificationsService from "./notifications.service.js";
import * as settingsService from "./settings.service.js";

export type EarningsRange = "week" | "month" | "quarter" | "year" | "all";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Inclusive date range for `createdAt` filter (server local clock). */
export function dateRangeForEarningsFilter(range: EarningsRange | undefined): { gte: Date; lte: Date } | undefined {
  if (!range || range === "all") return undefined;
  const now = new Date();
  const lte = endOfDay(now);
  let gte: Date;
  switch (range) {
    case "week": {
      const d = new Date(now);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      gte = startOfDay(d);
      break;
    }
    case "month":
      gte = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      break;
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      gte = startOfDay(new Date(now.getFullYear(), q * 3, 1));
      break;
    }
    case "year":
      gte = startOfDay(new Date(now.getFullYear(), 0, 1));
      break;
    default:
      return undefined;
  }
  return { gte, lte };
}

export function parseEarningsRangeQuery(q: unknown): EarningsRange {
  const s = typeof q === "string" ? q.toLowerCase().trim() : "";
  if (s === "week" || s === "month" || s === "quarter" || s === "year" || s === "all") return s;
  return "all";
}

const earningListInclude = {
  interpreter: { select: { id: true, name: true, email: true } },
  job: {
    select: {
      id: true,
      jobCode: true,
      language: true,
      startTime: true,
      endTime: true,
      serviceType: true,
      serviceCategory: true,
    },
  },
} as const;

export async function listEarningsForViewer(
  role: UserRole,
  viewerUserId: number,
  range: EarningsRange = "all",
) {
  const dr = dateRangeForEarningsFilter(range);
  const whereCreated =
    dr != null
      ? {
          createdAt: {
            gte: dr.gte,
            lte: dr.lte,
          },
        }
      : {};

  if (role === "INTERPRETER") {
    return prisma.earning.findMany({
      where: { interpreterId: viewerUserId, ...whereCreated },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: earningListInclude,
    });
  }

  return prisma.earning.findMany({
    where: whereCreated,
    orderBy: { createdAt: "desc" },
    take: 500,
    include: earningListInclude,
  });
}

export async function getEarningDetailForViewer(earningId: number, role: UserRole, viewerUserId: number) {
  const row = await prisma.earning.findUnique({
    where: { id: earningId },
    include: {
      interpreter: { select: { id: true, name: true, email: true } },
      job: {
        select: {
          id: true,
          jobCode: true,
          language: true,
          targetLanguage: true,
          serviceCategory: true,
          serviceType: true,
          startTime: true,
          endTime: true,
          interpretationType: true,
          client: { select: { name: true } },
        },
      },
    },
  });
  if (!row) return null;
  if (role === "INTERPRETER" && row.interpreterId !== viewerUserId) return null;

  const settings = await settingsService.getOrCreateSettings();
  const tokens = parseLinguistPaydays(settings.linguistPaydays);
  const mileage = row.mileageAmount ?? 0;
  const travel = row.travelAmount ?? 0;
  const serviceAmount = Math.max(0, row.amount - mileage - travel);
  const expectedPayDate =
    row.status === "PENDING" ? nextPaydayOnOrAfter(row.createdAt, tokens).toISOString() : null;

  return {
    ...row,
    serviceAmount,
    expectedPayDate,
  };
}

export async function updateEarningForStaff(earningId: number, role: UserRole, data: PatchEarningStaffInput) {
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") return null;

  const before = await prisma.earning.findUnique({
    where: { id: earningId },
    select: {
      status: true,
      interpreterId: true,
      amount: true,
      jobId: true,
      job: { select: { jobCode: true } },
    },
  });
  if (!before) return null;

  const patch: {
    status?: "PENDING" | "PAID";
    paidAt?: Date | null;
    notes?: string | null;
    amount?: number;
  } = {};
  if (data.status !== undefined) patch.status = data.status;
  if (data.paidAt !== undefined) patch.paidAt = data.paidAt ? new Date(data.paidAt) : null;
  else if (data.status === "PAID" && before.status !== "PAID") patch.paidAt = new Date();
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.amount !== undefined) patch.amount = data.amount;

  try {
    const row = await prisma.earning.update({
      where: { id: earningId },
      data: patch,
      include: {
        job: {
          select: {
            id: true,
            jobCode: true,
            language: true,
            startTime: true,
            endTime: true,
            serviceType: true,
            serviceCategory: true,
          },
        },
        interpreter: { select: { id: true, name: true, email: true } },
      },
    });

    if (patch.status === "PAID" && before.status !== "PAID" && row.interpreterId) {
      const ref = row.job ? formatJobReference(row.job) : formatJobReference({ id: row.jobId, jobCode: null });
      await notificationsService.createNotification(
        row.interpreterId,
        "EARNING_PAID",
        `Payment recorded for ${ref} ($${row.amount.toFixed(2)}). See Earnings for details.`,
      );
    }

    return row;
  } catch {
    return null;
  }
}
