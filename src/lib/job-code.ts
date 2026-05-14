import type { Prisma } from "#prisma-client";

const CODE_RE = /^(\d{2})T-(\d{4})$/;

/**
 * Next assignment code: `{YY}T-{NNNN}` (e.g. `26T-0001`).
 * YY is the calendar year when the job is created (rolls over each January).
 * Uses a per-year Postgres advisory lock so concurrent creates stay unique.
 */
export async function allocateJobCode(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const yy = String(year).slice(-2);
  const prefix = `${yy}T-`;

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(year)})`;

  const rows = await tx.job.findMany({
    where: { jobCode: { startsWith: prefix } },
    select: { jobCode: true },
  });

  let maxSeq = 0;
  for (const row of rows) {
    const code = row.jobCode;
    if (!code) continue;
    const m = code.match(CODE_RE);
    if (!m || m[1] !== yy) continue;
    const n = parseInt(m[2], 10);
    if (!Number.isNaN(n)) maxSeq = Math.max(maxSeq, n);
  }

  const next = maxSeq + 1;
  if (next > 9999) {
    throw new Error(`Job code sequence exhausted for year ${year}`);
  }

  return `${prefix}${String(next).padStart(4, "0")}`;
}
