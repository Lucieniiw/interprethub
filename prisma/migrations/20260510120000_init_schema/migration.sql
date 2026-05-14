-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'INTERPRETER');

-- CreateEnum
CREATE TYPE "InterpreterStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'VACATION', 'SICK_LEAVE');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('INTERPRETATION', 'TRANSLATION');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('IN_PERSON', 'VIRTUAL', 'PHONE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'ASSIGNED', 'COMPLETED', 'CANCELLED', 'PAID');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('STUDENT', 'PATIENT');

-- CreateEnum
CREATE TYPE "CompletionStatus" AS ENUM ('NONE', 'PENDING_REVIEW', 'APPROVED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "EarningStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phone" TEXT,
    "address" TEXT,
    "emergency_contact" TEXT,
    "profile_photo" TEXT,
    "interpreter_status" "InterpreterStatus" DEFAULT 'ACTIVE',
    "account_locked" BOOLEAN NOT NULL DEFAULT false,
    "residential_county" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "organization" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" SERIAL NOT NULL,
    "job_code" TEXT,
    "client_id" INTEGER,
    "service_category" "ServiceCategory" NOT NULL DEFAULT 'INTERPRETATION',
    "language" TEXT NOT NULL,
    "target_language" TEXT,
    "service_type" "ServiceType" NOT NULL DEFAULT 'IN_PERSON',
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER,
    "location" TEXT,
    "requester_email" TEXT,
    "recipient_type" "RecipientType",
    "recipient_name" TEXT,
    "interpretation_type" TEXT,
    "translation_due_date" TIMESTAMP(3),
    "attachment_url" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "interpreter_id" INTEGER,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "patient_name" TEXT,
    "staff_name" TEXT,
    "staff_signature" TEXT,
    "interpreter_signature" TEXT,
    "completion_status" "CompletionStatus" NOT NULL DEFAULT 'NONE',
    "completion_notes" TEXT,
    "interpreter_start_time" TIMESTAMP(3),
    "interpreter_end_time" TIMESTAMP(3),
    "interpreter_mileage" DOUBLE PRECISION,
    "interpreter_travel_time" DOUBLE PRECISION,
    "interpreter_notes" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_declines" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "interpreter_id" INTEGER NOT NULL,
    "declined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_declines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interpreter_profiles" (
    "id" SERIAL NOT NULL,
    "interpreter_id" INTEGER NOT NULL,
    "rate_in_person" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rate_virtual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rate_phone" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interpreter_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "earnings" (
    "id" SERIAL NOT NULL,
    "interpreter_id" INTEGER NOT NULL,
    "job_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "hours" DOUBLE PRECISION,
    "mileage_amount" DOUBLE PRECISION,
    "travel_amount" DOUBLE PRECISION,
    "status" "EarningStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "job_id" INTEGER,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "busy_slots" (
    "id" SERIAL NOT NULL,
    "interpreter_id" INTEGER NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "busy_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" SERIAL NOT NULL,
    "cancellation_policy_hours" INTEGER NOT NULL DEFAULT 24,
    "available_languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notification_rules" TEXT DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_job_code_key" ON "jobs"("job_code");

-- CreateIndex
CREATE UNIQUE INDEX "job_declines_job_id_interpreter_id_key" ON "job_declines"("job_id", "interpreter_id");

-- CreateIndex
CREATE UNIQUE INDEX "interpreter_profiles_interpreter_id_key" ON "interpreter_profiles"("interpreter_id");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_interpreter_id_fkey" FOREIGN KEY ("interpreter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_declines" ADD CONSTRAINT "job_declines_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_declines" ADD CONSTRAINT "job_declines_interpreter_id_fkey" FOREIGN KEY ("interpreter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interpreter_profiles" ADD CONSTRAINT "interpreter_profiles_interpreter_id_fkey" FOREIGN KEY ("interpreter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earnings" ADD CONSTRAINT "earnings_interpreter_id_fkey" FOREIGN KEY ("interpreter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earnings" ADD CONSTRAINT "earnings_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "busy_slots" ADD CONSTRAINT "busy_slots_interpreter_id_fkey" FOREIGN KEY ("interpreter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

