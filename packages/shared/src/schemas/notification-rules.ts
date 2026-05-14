import { z } from "zod";

/** Three delivery channels for job lifecycle alerts */
export const channels3Schema = z.object({
  inApp: z.boolean(),
  email: z.boolean(),
  push: z.boolean(),
});

export type Channels3 = z.infer<typeof channels3Schema>;

export const emailOnlySchema = z.object({
  email: z.boolean(),
});

export type EmailOnly = z.infer<typeof emailOnlySchema>;

/** Canonical minutes-before values allowed for reminder lead times */
export const REMINDER_LEAD_MINUTES = [2880, 1440, 720, 360, 60, 30] as const;

export type ReminderLeadMinutes = (typeof REMINDER_LEAD_MINUTES)[number];

export const REMINDER_LEAD_TIME_OPTIONS: ReadonlyArray<{ minutes: ReminderLeadMinutes; label: string }> = [
  { minutes: 2880, label: "48 hours" },
  { minutes: 1440, label: "24 hours" },
  { minutes: 720, label: "12 hours" },
  { minutes: 360, label: "6 hours" },
  { minutes: 60, label: "1 hour" },
  { minutes: 30, label: "30 minutes" },
];

const allowedLeadSet = new Set<number>(REMINDER_LEAD_MINUTES);

export function sanitizeReminderLeadTimesMinutes(raw: unknown): ReminderLeadMinutes[] {
  if (!Array.isArray(raw)) return [];
  const out = raw.filter((n): n is ReminderLeadMinutes =>
    typeof n === "number" && allowedLeadSet.has(n),
  );
  return [...new Set(out)].sort((a, b) => b - a);
}

export const reminderPreferencesSchema = channels3Schema.extend({
  /** Minutes before an appointment (or similar) to send a reminder; subset of REMINDER_LEAD_MINUTES */
  reminderLeadTimesMinutes: z.array(z.number().int()),
  /** Optional extra notes for reminder behavior */
  rulesText: z.string(),
});

export type ReminderPreferences = z.infer<typeof reminderPreferencesSchema>;

export const workspaceNotificationPreferencesSchema = z.object({
  acceptAssignment: channels3Schema,
  decline: channels3Schema,
  complete: channels3Schema,
  withdraw: channels3Schema,
  dailyReport: emailOnlySchema,
  weeklyReport: emailOnlySchema,
  interpreterAvailabilityUpdate: channels3Schema,
  reminder: reminderPreferencesSchema,
});

export type WorkspaceNotificationPreferences = z.infer<typeof workspaceNotificationPreferencesSchema>;

export function defaultWorkspaceNotificationPreferences(): WorkspaceNotificationPreferences {
  return {
    acceptAssignment: { inApp: true, email: true, push: false },
    decline: { inApp: true, email: true, push: false },
    complete: { inApp: true, email: true, push: false },
    withdraw: { inApp: true, email: true, push: false },
    dailyReport: { email: true },
    weeklyReport: { email: false },
    interpreterAvailabilityUpdate: { inApp: true, email: false, push: false },
    reminder: {
      inApp: true,
      email: true,
      push: false,
      reminderLeadTimesMinutes: [],
      rulesText: "",
    },
  };
}

function merge3(base: Channels3, raw: unknown): Channels3 {
  if (!raw || typeof raw !== "object") return { ...base };
  const v = raw as Record<string, unknown>;
  return {
    inApp: typeof v.inApp === "boolean" ? v.inApp : base.inApp,
    email: typeof v.email === "boolean" ? v.email : base.email,
    push: typeof v.push === "boolean" ? v.push : base.push,
  };
}

function mergeEmail(base: EmailOnly, raw: unknown): EmailOnly {
  if (!raw || typeof raw !== "object") return { ...base };
  const v = raw as Record<string, unknown>;
  return {
    email: typeof v.email === "boolean" ? v.email : base.email,
  };
}

function mergeReminder(base: ReminderPreferences, raw: unknown): ReminderPreferences {
  const c = merge3(base, raw);
  if (!raw || typeof raw !== "object") {
    return {
      ...c,
      reminderLeadTimesMinutes: base.reminderLeadTimesMinutes,
      rulesText: base.rulesText,
    };
  }
  const v = raw as Record<string, unknown>;
  const rulesText = typeof v.rulesText === "string" ? v.rulesText : base.rulesText;
  const reminderLeadTimesMinutes =
    v.reminderLeadTimesMinutes !== undefined
      ? sanitizeReminderLeadTimesMinutes(v.reminderLeadTimesMinutes)
      : base.reminderLeadTimesMinutes;
  return { ...c, rulesText, reminderLeadTimesMinutes };
}

/**
 * Parse stored `notificationRules` JSON from settings.
 * Unknown or invalid shapes merge with defaults.
 */
export function parseWorkspaceNotificationRules(raw: string | null): WorkspaceNotificationPreferences {
  const d = defaultWorkspaceNotificationPreferences();
  if (!raw?.trim()) return d;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return d;
    const o = j as Record<string, unknown>;
    return {
      acceptAssignment: merge3(d.acceptAssignment, o.acceptAssignment),
      decline: merge3(d.decline, o.decline),
      complete: merge3(d.complete, o.complete),
      withdraw: merge3(d.withdraw, o.withdraw),
      dailyReport: mergeEmail(d.dailyReport, o.dailyReport),
      weeklyReport: mergeEmail(d.weeklyReport, o.weeklyReport),
      interpreterAvailabilityUpdate: merge3(d.interpreterAvailabilityUpdate, o.interpreterAvailabilityUpdate),
      reminder: mergeReminder(d.reminder, o.reminder),
    };
  } catch {
    return d;
  }
}

export function serializeWorkspaceNotificationPreferences(p: WorkspaceNotificationPreferences): string {
  const normalized: WorkspaceNotificationPreferences = {
    ...p,
    reminder: {
      ...p.reminder,
      reminderLeadTimesMinutes: [...p.reminder.reminderLeadTimesMinutes].sort((a, b) => b - a),
    },
  };
  return `${JSON.stringify(normalized, null, 2)}\n`;
}
