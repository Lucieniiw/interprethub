-- CreateEnum
CREATE TYPE "InterpreterSessionOutcome" AS ENUM ('COMPLETED_SESSION', 'LATE_CANCELLATION');

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "interpreter_travel_outside_county" BOOLEAN;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "interpreter_session_outcome" "InterpreterSessionOutcome";
