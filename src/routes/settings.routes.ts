import { Router } from "express";
import { updateSettingsSchema } from "@interpret-hub/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.middleware.js";
import * as settingsService from "../services/settings.service.js";

export const settingsRouter = Router();

settingsRouter.get("/settings", requireAuth, async (req: AuthedRequest, res) => {
  const row = await settingsService.getOrCreateSettings();
  if (req.auth!.role === "ADMIN" || req.auth!.role === "SUPER_ADMIN") {
    res.json(row);
    return;
  }
  res.json(settingsService.toInterpreterSettingsView(row));
});

settingsRouter.patch("/settings", requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "ADMIN" && req.auth!.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Coordinator access required" });
    return;
  }
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const row = await settingsService.updateSettings(parsed.data);
  res.json(row);
});
