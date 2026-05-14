import { z } from "zod";

export const jobStatusSchema = z.enum(["OPEN", "ASSIGNED", "COMPLETED", "CANCELLED", "PAID"]);
export const serviceCategorySchema = z.enum(["INTERPRETATION", "TRANSLATION"]);
export const serviceTypeSchema = z.enum(["IN_PERSON", "VIRTUAL", "PHONE"]);

/** Minimum scheduled session length by modality (interpretation jobs). */
export const INTERPRETATION_MIN_MINUTES: Record<z.infer<typeof serviceTypeSchema>, number> = {
  IN_PERSON: 120,
  VIRTUAL: 60,
  PHONE: 60,
};

/** Returns an error message if the window is shorter than the modality minimum, otherwise null. */
export function interpretationSessionMinDurationMessage(
  serviceType: z.infer<typeof serviceTypeSchema>,
  startMs: number,
  endMs: number,
): string | null {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  const minutes = (endMs - startMs) / 60_000;
  const min = INTERPRETATION_MIN_MINUTES[serviceType];
  if (minutes + 1e-9 >= min) return null;
  return serviceType === "IN_PERSON"
    ? "In-person sessions must be at least 2 hours."
    : "Phone and virtual sessions must be at least 1 hour.";
}

/** Stored in `interpretationType` for interpretation jobs */
export const interpretationDomainSchema = z.enum(["IMMIGRATION", "MEDICAL", "SOCIAL_SERVICES", "OTHER"]);

const optionalEmail = z.preprocess(
  (val) => (val === "" || val === undefined ? null : val),
  z.union([z.string().email(), z.null()]).optional(),
);

const jobPayloadSchema = z.object({
  clientId: z.number().int().positive().optional().nullable(),
  serviceCategory: serviceCategorySchema.default("INTERPRETATION"),
  language: z.string().min(1),
  targetLanguage: z.string().optional().nullable(),
  serviceType: serviceTypeSchema.default("IN_PERSON"),
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
  durationMinutes: z.number().int().positive().optional().nullable(),
  location: z.string().optional().nullable(),
  requesterEmail: optionalEmail,
  requesterName: z.string().optional().nullable(),
  recipientName: z.string().optional().nullable(),
  interpretationType: z.string().optional().nullable(),
  translationDueDate: z.string().datetime().optional().nullable(),
  translationClientName: z.string().optional().nullable(),
  rushFee: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
  interpreterId: z.number().int().positive().optional().nullable(),
  rate: z.number().nonnegative().optional().default(0),
});

export const createJobSchema = jobPayloadSchema.superRefine((data, ctx) => {
  if (data.serviceCategory === "INTERPRETATION") {
    if (!data.startTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Session start is required", path: ["startTime"] });
    }
    if (!data.endTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Session end is required", path: ["endTime"] });
    }
    if (!data.interpretationType?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Service type is required", path: ["interpretationType"] });
    }
    const st = data.startTime ? Date.parse(data.startTime) : NaN;
    const en = data.endTime ? Date.parse(data.endTime) : NaN;
    if (!Number.isNaN(st) && !Number.isNaN(en) && en <= st) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Session end must be after start", path: ["endTime"] });
    }
    if (!Number.isNaN(st) && !Number.isNaN(en) && en > st) {
      const durMsg = interpretationSessionMinDurationMessage(data.serviceType, st, en);
      if (durMsg) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: durMsg, path: ["endTime"] });
      }
    }
  }
  if (data.serviceCategory === "TRANSLATION") {
    if (!data.translationDueDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Due date is required", path: ["translationDueDate"] });
    }
    if (!data.targetLanguage?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Target language is required", path: ["targetLanguage"] });
    }
  }
});

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const completionStatusSchema = z.enum(["NONE", "PENDING_REVIEW", "APPROVED", "DISPUTED"]);

export const updateJobStaffSchema = jobPayloadSchema.partial().extend({
  status: jobStatusSchema.optional(),
  interpreterId: z.number().int().positive().optional().nullable(),
  /** Coordinator review of interpreter-submitted completion */
  completionStatus: completionStatusSchema.optional(),
  /** Shown to the linguist when disputing (optional). Cleared when completion is approved. */
  completionDisputeNote: z.string().max(4000).optional().nullable(),
});

export type UpdateJobStaffInput = z.infer<typeof updateJobStaffSchema>;

export const interpreterSessionOutcomeSchema = z.enum(["COMPLETED_SESSION", "LATE_CANCELLATION"]);

export const completeJobInterpreterSchema = z.object({
  completionStatus: completionStatusSchema.optional(),
  completionNotes: z.string().optional().nullable(),
  interpreterStartTime: z.string().datetime().optional().nullable(),
  interpreterEndTime: z.string().datetime().optional().nullable(),
  interpreterMileage: z.number().nonnegative().optional().nullable(),
  interpreterTravelTime: z.number().nonnegative().optional().nullable().describe("Billable travel time in minutes"),
  /** When true, linguist traveled outside their residential county (travel time may apply). */
  travelOutsideCounty: z.boolean().optional(),
  interpreterNotes: z.string().optional().nullable(),
  interpreterSignature: z.string().optional().nullable(),
  staffName: z.string().optional().nullable(),
  staffSignature: z.string().optional().nullable(),
  sessionOutcome: interpreterSessionOutcomeSchema.optional(),
  /** When true, sets job status to COMPLETED (or CANCELLED for late cancellation) and syncs earnings when applicable */
  markCompleted: z.boolean().optional(),
});

export type CompleteJobInterpreterInput = z.infer<typeof completeJobInterpreterSchema>;
