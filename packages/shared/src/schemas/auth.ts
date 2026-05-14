import { z } from "zod";
import { updateInterpreterRatesSchema } from "./profile.js";

export const loginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().min(1).trim(),
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(8),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "INTERPRETER"]),
  languages: z.array(z.string()).optional().default([]),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/** Admin creates user without a password; invite email contains a link to set password */
export const inviteUserSchema = z.object({
  name: z.string().min(1).trim(),
  email: z.string().email().trim().toLowerCase(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "INTERPRETER"]),
  languages: z.array(z.string()).optional().default([]),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

/** Admin updates another user (optional fields — only send what changes). */
export const updateUserSchema = z.object({
  name: z.string().min(1).trim().optional(),
  email: z.string().email().trim().toLowerCase().optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "INTERPRETER"]).optional(),
  languages: z.array(z.string()).optional(),
  phone: z.string().trim().nullable().optional(),
  interpreterStatus: z.enum(["ACTIVE", "INACTIVE", "VACATION", "SICK_LEAVE"]).nullable().optional(),
  /** Pay rates for interpreters — separate from client billing rates */
  linguistPayRates: updateInterpreterRatesSchema.optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
