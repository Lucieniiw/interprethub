import { prisma } from "../lib/prisma.js";

export async function logActivity(input: {
  type: string;
  message: string;
  jobId?: number | null;
  userId?: number | null;
}) {
  return prisma.activity.create({
    data: {
      type: input.type,
      message: input.message,
      jobId: input.jobId ?? undefined,
      userId: input.userId ?? undefined,
    },
  });
}

export async function listActivityForStaff(take = 100) {
  return prisma.activity.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
}
