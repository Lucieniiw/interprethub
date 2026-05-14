import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * CLI config (migrate, seed). Connection URL stays in prisma/schema.prisma for Prisma ORM 6.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
