-- AlterTable
ALTER TABLE "interpreter_profiles" ADD COLUMN "rate_mileage" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "interpreter_profiles" ADD COLUMN "rate_travel_time" DOUBLE PRECISION NOT NULL DEFAULT 0;
