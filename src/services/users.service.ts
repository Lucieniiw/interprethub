import type { InterpreterStatus, UserRole } from "#prisma-client";
import { prisma } from "../lib/prisma.js";

export async function listUsersSummary() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      languages: true,
      interpreterStatus: true,
      phone: true,
      profilePhoto: true,
      createdAt: true,
      accountLocked: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    take: 500,
  });
}

export async function getUserById(id: number) {
  return prisma.user.findUnique({ where: { id } });
}

/** Coordinator detail view — no password hash */
export async function getUserDetailForStaff(id: number) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      languages: true,
      interpreterStatus: true,
      phone: true,
      address: true,
      profilePhoto: true,
      createdAt: true,
      accountLocked: true,
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
  });
}

export async function unlockUser(id: number) {
  return prisma.user.update({
    where: { id },
    data: { accountLocked: false, failedLoginAttempts: 0 },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      languages: true,
      interpreterStatus: true,
      phone: true,
      profilePhoto: true,
      createdAt: true,
      accountLocked: true,
    },
  });
}

export async function lockUser(id: number) {
  return prisma.user.update({
    where: { id },
    data: { accountLocked: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      languages: true,
      interpreterStatus: true,
      phone: true,
      profilePhoto: true,
      createdAt: true,
      accountLocked: true,
    },
  });
}

export async function deleteUser(id: number) {
  await prisma.$transaction(async (tx) => {
    await tx.job.updateMany({ where: { interpreterId: id }, data: { interpreterId: null } });
    await tx.activity.updateMany({ where: { userId: id }, data: { userId: null } });
    await tx.user.delete({ where: { id } });
  });
}

export async function updateUser(
  id: number,
  data: {
    name?: string;
    email?: string;
    role?: UserRole;
    languages?: string[];
    phone?: string | null;
    interpreterStatus?: InterpreterStatus | null;
  },
) {
  return prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      languages: true,
      interpreterStatus: true,
      phone: true,
      createdAt: true,
      accountLocked: true,
    },
  });
}

/** Staff-set linguist pay rates (InterpreterProfile) — not client billing */
export async function upsertInterpreterPayRates(
  interpreterId: number,
  data: {
    rateInPerson?: number;
    rateVirtual?: number;
    ratePhone?: number;
    rateMileage?: number;
    rateTravelTime?: number;
  },
) {
  const hasAny =
    data.rateInPerson !== undefined ||
    data.rateVirtual !== undefined ||
    data.ratePhone !== undefined ||
    data.rateMileage !== undefined ||
    data.rateTravelTime !== undefined;
  if (!hasAny) return null;
  return prisma.interpreterProfile.upsert({
    where: { interpreterId },
    create: {
      interpreterId,
      rateInPerson: data.rateInPerson ?? 0,
      rateVirtual: data.rateVirtual ?? 0,
      ratePhone: data.ratePhone ?? 0,
      rateMileage: data.rateMileage ?? 0,
      rateTravelTime: data.rateTravelTime ?? 0,
    },
    update: {
      ...(data.rateInPerson !== undefined ? { rateInPerson: data.rateInPerson } : {}),
      ...(data.rateVirtual !== undefined ? { rateVirtual: data.rateVirtual } : {}),
      ...(data.ratePhone !== undefined ? { ratePhone: data.ratePhone } : {}),
      ...(data.rateMileage !== undefined ? { rateMileage: data.rateMileage } : {}),
      ...(data.rateTravelTime !== undefined ? { rateTravelTime: data.rateTravelTime } : {}),
    },
  });
}
