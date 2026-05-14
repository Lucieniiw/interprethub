-- CreateEnum
CREATE TYPE "JobOperationalStatus" AS ENUM ('OPEN', 'OFFERED', 'ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobBillingStatus" AS ENUM ('UNBILLED', 'EXPORTED', 'PAID');

-- CreateEnum
CREATE TYPE "JobOfferMode" AS ENUM ('BROADCAST', 'SEQUENTIAL', 'DIRECT');

-- CreateEnum
CREATE TYPE "JobOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "JobAssignmentRole" AS ENUM ('PRIMARY', 'BACKUP', 'RELAY');

-- CreateEnum
CREATE TYPE "JobAssignmentState" AS ENUM ('INVITED', 'CONFIRMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "JobReviewDecision" AS ENUM ('APPROVED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ExportBatchStatus" AS ENUM ('DRAFT', 'COMMITTED', 'FAILED');

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "operational_status" "JobOperationalStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "billing_status" "JobBillingStatus" NOT NULL DEFAULT 'UNBILLED',
ADD COLUMN "published_at" TIMESTAMP(3),
ADD COLUMN "billing_locked_at" TIMESTAMP(3),
ADD COLUMN "scheduling_timezone" TEXT;

-- Data migration: operational / billing from legacy status + completion
UPDATE "jobs" SET "operational_status" = CASE
    WHEN "status" = 'OPEN'::"JobStatus" THEN 'OPEN'::"JobOperationalStatus"
    WHEN "status" = 'ASSIGNED'::"JobStatus" THEN 'ASSIGNED'::"JobOperationalStatus"
    WHEN "status" = 'CANCELLED'::"JobStatus" THEN 'CANCELLED'::"JobOperationalStatus"
    WHEN "status" = 'PAID'::"JobStatus" THEN 'COMPLETED'::"JobOperationalStatus"
    WHEN "status" = 'COMPLETED'::"JobStatus" THEN CASE
        WHEN "completion_status" IN ('PENDING_REVIEW'::"CompletionStatus", 'DISPUTED'::"CompletionStatus") THEN 'UNDER_REVIEW'::"JobOperationalStatus"
        ELSE 'COMPLETED'::"JobOperationalStatus"
    END
    ELSE 'OPEN'::"JobOperationalStatus"
END;

UPDATE "jobs" SET "billing_status" = CASE
    WHEN "status" = 'PAID'::"JobStatus" THEN 'PAID'::"JobBillingStatus"
    ELSE 'UNBILLED'::"JobBillingStatus"
END;

-- CreateTable
CREATE TABLE "job_events" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "actor_user_id" INTEGER,
    "previous_operational_status" "JobOperationalStatus",
    "new_operational_status" "JobOperationalStatus",
    "previous_billing_status" "JobBillingStatus",
    "new_billing_status" "JobBillingStatus",
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_offers" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "interpreter_id" INTEGER NOT NULL,
    "mode" "JobOfferMode" NOT NULL DEFAULT 'BROADCAST',
    "status" "JobOfferStatus" NOT NULL DEFAULT 'PENDING',
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_assignments" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "interpreter_id" INTEGER NOT NULL,
    "role" "JobAssignmentRole" NOT NULL DEFAULT 'PRIMARY',
    "state" "JobAssignmentState" NOT NULL DEFAULT 'CONFIRMED',
    "planned_start_at" TIMESTAMP(3) NOT NULL,
    "planned_end_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_submissions" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "assignment_id" INTEGER,
    "revision" INTEGER NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "submitted_by_id" INTEGER NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_reviews" (
    "id" SERIAL NOT NULL,
    "submission_id" INTEGER NOT NULL,
    "decision" "JobReviewDecision" NOT NULL,
    "reason" TEXT,
    "reviewed_by_id" INTEGER NOT NULL,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_batches" (
    "id" SERIAL NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "status" "ExportBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "batch_type" TEXT NOT NULL DEFAULT 'QUICKBOOKS',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committed_at" TIMESTAMP(3),

    CONSTRAINT "export_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_line_items" (
    "id" SERIAL NOT NULL,
    "export_batch_id" INTEGER NOT NULL,
    "job_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "quickbooks_invoice_id" TEXT,
    "quickbooks_bill_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_events_job_id_created_at_idx" ON "job_events"("job_id", "created_at");

-- CreateIndex
CREATE INDEX "job_offers_job_id_status_idx" ON "job_offers"("job_id", "status");

-- CreateIndex
CREATE INDEX "job_offers_interpreter_id_status_idx" ON "job_offers"("interpreter_id", "status");

-- CreateIndex
CREATE INDEX "job_assignments_interpreter_id_planned_start_at_planned_end_at_idx" ON "job_assignments"("interpreter_id", "planned_start_at", "planned_end_at");

-- CreateIndex
CREATE INDEX "jobs_interpreter_id_start_time_end_time_idx" ON "jobs"("interpreter_id", "start_time", "end_time");

-- CreateIndex
CREATE UNIQUE INDEX "job_submissions_job_id_revision_key" ON "job_submissions"("job_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "export_line_items_export_batch_id_job_id_key" ON "export_line_items"("export_batch_id", "job_id");

-- AddForeignKey
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_events" ADD CONSTRAINT "job_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_interpreter_id_fkey" FOREIGN KEY ("interpreter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_interpreter_id_fkey" FOREIGN KEY ("interpreter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_submissions" ADD CONSTRAINT "job_submissions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_submissions" ADD CONSTRAINT "job_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "job_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_submissions" ADD CONSTRAINT "job_submissions_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_reviews" ADD CONSTRAINT "job_reviews_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "job_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_reviews" ADD CONSTRAINT "job_reviews_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "export_batches" ADD CONSTRAINT "export_batches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "export_line_items" ADD CONSTRAINT "export_line_items_export_batch_id_fkey" FOREIGN KEY ("export_batch_id") REFERENCES "export_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "export_line_items" ADD CONSTRAINT "export_line_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill primary assignments for existing interpreter assignments
INSERT INTO "job_assignments" ("job_id", "interpreter_id", "role", "state", "planned_start_at", "planned_end_at", "created_at", "updated_at")
SELECT "id", "interpreter_id", 'PRIMARY'::"JobAssignmentRole", 'CONFIRMED'::"JobAssignmentState", "start_time", "end_time", "created_at", "updated_at"
FROM "jobs"
WHERE "interpreter_id" IS NOT NULL;
