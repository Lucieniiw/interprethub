import type { SystemSettings } from "#prisma-client";
import type { UpdateSettingsInput } from "@interpret-hub/shared";
import { prisma } from "../lib/prisma.js";

export type InterpreterSettingsView = {
  cancellationPolicyHours: number;
  availableLanguages: string[];
  linguistPaydays: string;
};

export function toInterpreterSettingsView(row: SystemSettings): InterpreterSettingsView {
  return {
    cancellationPolicyHours: row.cancellationPolicyHours,
    availableLanguages: row.availableLanguages,
    linguistPaydays: row.linguistPaydays,
  };
}

export async function getOrCreateSettings() {
  let row = await prisma.systemSettings.findFirst();
  if (!row) {
    row = await prisma.systemSettings.create({
      data: {
        cancellationPolicyHours: 24,
        availableLanguages: ["Spanish", "French", "Mandarin"],
        notificationRules: "{}",
      },
    });
  }
  return row;
}

export async function updateSettings(data: UpdateSettingsInput) {
  const current = await getOrCreateSettings();
  return prisma.systemSettings.update({
    where: { id: current.id },
    data: {
      ...(data.cancellationPolicyHours !== undefined
        ? { cancellationPolicyHours: data.cancellationPolicyHours }
        : {}),
      ...(data.availableLanguages !== undefined ? { availableLanguages: data.availableLanguages } : {}),
      ...(data.notificationRules !== undefined ? { notificationRules: data.notificationRules } : {}),
      ...(data.linguistPaydays !== undefined ? { linguistPaydays: data.linguistPaydays } : {}),
    },
  });
}
