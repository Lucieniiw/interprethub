import { z } from "zod";

const rateField = z.number().nonnegative().optional();

export const createClientSchema = z.object({
  name: z.string().min(1).trim(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  organization: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  rateInPerson: rateField,
  ratePhone: rateField,
  rateVirtual: rateField,
  rateMileage: rateField,
  rateTravelTime: rateField,
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
