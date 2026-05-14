-- AlterTable
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "requester_name" TEXT,
ADD COLUMN IF NOT EXISTS "translation_client_name" TEXT,
ADD COLUMN IF NOT EXISTS "rush_fee" DOUBLE PRECISION;
