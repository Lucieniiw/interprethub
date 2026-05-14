/**
 * Upserts two SUPER_ADMIN accounts (bcrypt cost 12, same as the API).
 *
 * Do not put real passwords in this file or in git. Either:
 *
 * A) Set env vars in the shell, then run from InterpretHub root:
 *
 * PowerShell:
 *   $env:BOOTSTRAP_SUPERADMIN_1_PASSWORD = 'your-first-password'
 *   $env:BOOTSTRAP_SUPERADMIN_2_PASSWORD = 'your-second-password'
 *   pnpm run bootstrap:super-admins
 *
 * B) Create a **gitignored** file `.env.bootstrap.local` in InterpretHub (same folder as `.env`) with:
 *   BOOTSTRAP_SUPERADMIN_1_PASSWORD=...
 *   BOOTSTRAP_SUPERADMIN_2_PASSWORD=...
 *   then run: pnpm run bootstrap:super-admins
 *   Delete the file after use.
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "../generated/prisma/index.js";

const BCRYPT_COST = 12;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env"), override: true });
/** Optional one-time passwords (gitignored). Same keys as shell env — never commit this file. */
const bootstrapEnv = path.join(root, ".env.bootstrap.local");
if (fs.existsSync(bootstrapEnv)) {
  config({ path: bootstrapEnv, override: true });
}

const prisma = new PrismaClient();

const ACCOUNTS = [
  {
    email: "lmasudi@iiwisconsin.org",
    name: "L Masudi",
    passwordEnv: "BOOTSTRAP_SUPERADMIN_1_PASSWORD",
  },
  {
    email: "lucieniiw@gmail.com",
    name: "Lucien IIW",
    passwordEnv: "BOOTSTRAP_SUPERADMIN_2_PASSWORD",
  },
] as const;

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[bootstrap] DATABASE_URL is not set. Load InterpretHub/.env or export DATABASE_URL.");
    process.exit(1);
  }

  const missing = ACCOUNTS.filter((a) => !process.env[a.passwordEnv]?.trim()).map((a) => a.passwordEnv);
  if (missing.length > 0) {
    console.error(
      `[bootstrap] Missing: ${missing.join(", ")}\n` +
        "  Option A — PowerShell (same window before pnpm):\n" +
        "    $env:BOOTSTRAP_SUPERADMIN_1_PASSWORD = '...'\n" +
        "    $env:BOOTSTRAP_SUPERADMIN_2_PASSWORD = '...'\n" +
        "  Option B — create InterpretHub/.env.bootstrap.local (gitignored) with those two keys, then run again.\n" +
        "  Use single quotes in PowerShell if passwords contain # @ + etc.",
    );
    process.exit(1);
  }

  for (const row of ACCOUNTS) {
    const plain = process.env[row.passwordEnv]!.trim();
    const passwordHash = await bcrypt.hash(plain, BCRYPT_COST);
    await prisma.user.upsert({
      where: { email: row.email },
      create: {
        name: row.name,
        email: row.email,
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        languages: [],
        accountLocked: false,
        failedLoginAttempts: 0,
      },
      update: {
        name: row.name,
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        accountLocked: false,
        failedLoginAttempts: 0,
      },
    });
    console.log(`[bootstrap] Upserted SUPER_ADMIN: ${row.email}`);
  }

  console.log("[bootstrap] Done. Unset BOOTSTRAP_SUPERADMIN_* env vars when finished.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });
