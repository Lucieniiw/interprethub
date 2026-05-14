import { z } from "zod";

export const createBusySlotSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  reason: z.string().max(500).optional().nullable(),
});

export type CreateBusySlotInput = z.infer<typeof createBusySlotSchema>;
