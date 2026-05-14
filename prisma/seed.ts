import { PrismaClient, UserRole } from "../generated/prisma/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = (p: string) => bcrypt.hash(p, 10);

  const settingsCount = await prisma.systemSettings.count();
  if (settingsCount === 0) {
    await prisma.systemSettings.create({
      data: {
        availableLanguages: ["Spanish", "French", "Mandarin", "Arabic", "Hmong"],
        cancellationPolicyHours: 24,
        notificationRules: "{}",
      },
    });
  }

  let client = await prisma.client.findFirst({
    where: { email: "admin@metrogeneral.org" },
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        name: "Metro General Hospital",
        email: "admin@metrogeneral.org",
        organization: "Metro General Hospital",
      },
    });
  }

  const superAdminHash = await hash("admin123");
  await prisma.user.upsert({
    where: { email: "superadmin@interprethub.com" },
    create: {
      name: "Sarah Mitchell",
      email: "superadmin@interprethub.com",
      passwordHash: superAdminHash,
      role: UserRole.SUPER_ADMIN,
      languages: [],
    },
    update: {
      passwordHash: superAdminHash,
      name: "Sarah Mitchell",
      role: UserRole.SUPER_ADMIN,
    },
  });

  const adminHash = await hash("admin123");
  await prisma.user.upsert({
    where: { email: "admin@interprethub.com" },
    create: {
      name: "James Carter",
      email: "admin@interprethub.com",
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      languages: [],
    },
    update: {
      passwordHash: adminHash,
      name: "James Carter",
      role: UserRole.ADMIN,
    },
  });

  const interpHash = await hash("interp123");
  const interp = await prisma.user.upsert({
    where: { email: "maria@interprethub.com" },
    create: {
      name: "Maria Lopez",
      email: "maria@interprethub.com",
      passwordHash: interpHash,
      role: UserRole.INTERPRETER,
      languages: ["Spanish", "French"],
    },
    update: {
      passwordHash: interpHash,
      name: "Maria Lopez",
      role: UserRole.INTERPRETER,
      languages: ["Spanish", "French"],
    },
  });

  await prisma.interpreterProfile.upsert({
    where: { interpreterId: interp.id },
    create: {
      interpreterId: interp.id,
      rateInPerson: 75,
      rateVirtual: 65,
      ratePhone: 55,
    },
    update: {},
  });

  const jobCount = await prisma.job.count();
  if (jobCount === 0) {
    const start = new Date();
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(12, 0, 0, 0);

    await prisma.job.create({
      data: {
        jobCode: "26T-0001",
        clientId: client.id,
        language: "Spanish",
        serviceType: "IN_PERSON",
        startTime: start,
        endTime: end,
        durationMinutes: 120,
        location: "Main campus — Room 204",
        status: "OPEN",
        rate: 75,
      },
    });
  }

  console.log(
    "Seed OK. Demo users created (change passwords before any real use). Run `pnpm run bootstrap:super-admins` with BOOTSTRAP_SUPERADMIN_1_PASSWORD and BOOTSTRAP_SUPERADMIN_2_PASSWORD to add production super admins.",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
