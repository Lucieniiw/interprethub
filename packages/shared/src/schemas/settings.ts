import { z } from "zod";

export const updateSettingsSchema = z.object({
  cancellationPolicyHours: z.number().int().positive().optional(),
  availableLanguages: z.array(z.string()).optional(),
  notificationRules: z.string().optional().nullable(),
  /** Comma-separated: day-of-month 1–31 and/or LAST (e.g. `15,LAST`). */
  linguistPaydays: z.string().max(200).optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
