import { z } from "zod";

export const patchEarningStaffSchema = z.object({
  status: z.enum(["PENDING", "PAID"]),
  paidAt: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  amount: z.number().nonnegative().optional(),
});

export type PatchEarningStaffInput = z.infer<typeof patchEarningStaffSchema>;
