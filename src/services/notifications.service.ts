import { prisma } from "../lib/prisma.js";

export async function createNotification(userId: number, type: string, message: string) {
  return prisma.notification.create({
    data: { userId, type, message },
  });
}

export async function listForUser(userId: number, take = 40) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function markRead(id: number, userId: number) {
  const n = await prisma.notification.findFirst({ where: { id, userId } });
  if (!n) return null;
  return prisma.notification.update({
    where: { id },
    data: { read: true },
  });
}

export async function markAllRead(userId: number) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

export async function unreadCount(userId: number) {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}
