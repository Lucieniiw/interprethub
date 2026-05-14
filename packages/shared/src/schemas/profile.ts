import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  languages: z.array(z.string()).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateInterpreterRatesSchema = z.object({
  rateInPerson: z.number().nonnegative().optional(),
  rateVirtual: z.number().nonnegative().optional(),
  ratePhone: z.number().nonnegative().optional(),
  rateMileage: z.number().nonnegative().optional(),
  rateTravelTime: z.number().nonnegative().optional(),
});

export type UpdateInterpreterRatesInput = z.infer<typeof updateInterpreterRatesSchema>;
