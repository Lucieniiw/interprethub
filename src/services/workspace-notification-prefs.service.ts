import { parseWorkspaceNotificationRules } from "@interpret-hub/shared";
import { getOrCreateSettings } from "./settings.service.js";

export async function getWorkspaceNotificationPreferences() {
  const row = await getOrCreateSettings();
  return parseWorkspaceNotificationRules(row.notificationRules);
}
