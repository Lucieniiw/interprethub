import type { CreateClientInput, UpdateClientInput } from "@interpret-hub/shared";
import { prisma } from "../lib/prisma.js";

export async function listClients() {
  return prisma.client.findMany({
    orderBy: { name: "asc" },
    take: 500,
  });
}

export async function createClient(data: CreateClientInput) {
  return prisma.client.create({
    data: {
      name: data.name,
      email: data.email ?? undefined,
      phone: data.phone ?? undefined,
      organization: data.organization ?? undefined,
      industry: data.industry ?? undefined,
      address: data.address ?? undefined,
      rateInPerson: data.rateInPerson ?? 0,
      ratePhone: data.ratePhone ?? 0,
      rateVirtual: data.rateVirtual ?? 0,
      rateMileage: data.rateMileage ?? 0,
      rateTravelTime: data.rateTravelTime ?? 0,
    },
  });
}

export async function updateClient(id: number, data: UpdateClientInput) {
  return prisma.client.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.organization !== undefined ? { organization: data.organization } : {}),
      ...(data.industry !== undefined ? { industry: data.industry } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.rateInPerson !== undefined ? { rateInPerson: data.rateInPerson } : {}),
      ...(data.ratePhone !== undefined ? { ratePhone: data.ratePhone } : {}),
      ...(data.rateVirtual !== undefined ? { rateVirtual: data.rateVirtual } : {}),
      ...(data.rateMileage !== undefined ? { rateMileage: data.rateMileage } : {}),
      ...(data.rateTravelTime !== undefined ? { rateTravelTime: data.rateTravelTime } : {}),
    },
  });
}

export async function deleteClient(id: number) {
  const n = await prisma.job.count({ where: { clientId: id } });
  if (n > 0) return { deleted: false as const, reason: "has_jobs" as const };
  await prisma.client.delete({ where: { id } });
  return { deleted: true as const };
}
