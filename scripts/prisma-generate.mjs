/**
 * Runs `prisma generate` with retries. On Windows, EPERM during engine rename is common
 * when another Node process (e.g. `pnpm run dev`) holds the query engine DLL — stop dev first.
 *
 * Usage:
 *   node scripts/prisma-generate.mjs
 *   node scripts/prisma-generate.mjs --clean   # rm -rf generated/prisma first (needs no Node holding DLL)
 *
 * Env:
 *   PRISMA_GENERATE_RETRIES=6
 *   PRISMA_GENERATE_CLEAN=1   # same as --clean
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedPrisma = path.join(root, "generated", "prisma");

const clean =
  process.argv.includes("--clean") ||
  process.argv.includes("-c") ||
  process.env.PRISMA_GENERATE_CLEAN === "1";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Best-effort: unlocks in-place generate when the old engine file is not loaded. */
function tryRemoveEngineBinaries() {
  if (!fs.existsSync(generatedPrisma)) return;
  try {
    for (const name of fs.readdirSync(generatedPrisma)) {
      if (!name.endsWith(".node")) continue;
      try {
        fs.unlinkSync(path.join(generatedPrisma, name));
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Full wipe of generated client (use after stopping all Node processes that used this repo).
 * Node 14.14+ supports maxRetries/retryDelay on Windows for transient EPERM.
 */
function tryWipeGeneratedPrisma() {
  if (!fs.existsSync(generatedPrisma)) return;
  try {
    fs.rmSync(generatedPrisma, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 300,
    });
    console.log("[prisma-generate] Removed generated/prisma (clean)");
  } catch (e) {
    console.warn(
      "[prisma-generate] Could not remove generated/prisma:",
      e instanceof Error ? e.message : e,
    );
  }
}

const attempts = Number(process.env.PRISMA_GENERATE_RETRIES ?? "6");

async function main() {
  if (clean) {
    tryWipeGeneratedPrisma();
  }

  for (let i = 1; i <= attempts; i++) {
    tryRemoveEngineBinaries();
    try {
      execSync("pnpm exec prisma generate", { cwd: root, stdio: "inherit", shell: true });
      process.exit(0);
    } catch {
      if (i === attempts) {
        console.error(`
[prisma-generate] Failed after ${attempts} attempt(s).

On Windows, EPERM almost always means a running Node process still has the Prisma engine open.

Do this:
  1. Stop the API and web dev servers (every terminal running \`pnpm run dev\`, \`tsx watch\`, etc.).
  2. In Task Manager, end any stray "Node.js JavaScript Runtime" tasks that point at this project.
  3. From this folder (${root}), run ONE of:
       pnpm run db:generate
       pnpm run db:generate:clean

If it still fails, temporarily pause real-time antivirus for this folder or reboot (last resort for DLL locks).
`);
        process.exit(1);
      }
      await sleep(600 * i);
    }
  }
}

await main();
