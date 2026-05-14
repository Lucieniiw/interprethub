import type { UserRole } from "#prisma-client";
import { prisma } from "../lib/prisma.js";

export async function listBusySlotsForViewer(role: UserRole, viewerUserId: number) {
  if (role === "INTERPRETER") {
    return prisma.busySlot.findMany({
      where: { interpreterId: viewerUserId },
      orderBy: { startTime: "asc" },
      take: 200,
    });
  }

  return prisma.busySlot.findMany({
    orderBy: { startTime: "desc" },
    take: 400,
    include: {
      interpreter: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function createBusySlotForInterpreter(
  interpreterId: number,
  startTime: Date,
  endTime: Date,
  reason?: string | null,
) {
  return prisma.busySlot.create({
    data: {
      interpreterId,
      startTime,
      endTime,
      reason: reason ?? undefined,
    },
  });
}

export async function deleteBusySlotForViewer(
  id: number,
  role: UserRole,
  viewerUserId: number,
) {
  const slot = await prisma.busySlot.findUnique({ where: { id } });
  if (!slot) return { deleted: false as const, reason: "not_found" as const };
  if (role === "INTERPRETER" && slot.interpreterId !== viewerUserId) {
    return { deleted: false as const, reason: "forbidden" as const };
  }
  await prisma.busySlot.delete({ where: { id } });
  return { deleted: true as const };
}
