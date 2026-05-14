import { Router } from "express";
import { createBusySlotSchema } from "@interpret-hub/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.middleware.js";
import * as busySlotsService from "../services/busy-slots.service.js";

export const busySlotsRouter = Router();

busySlotsRouter.get("/busy-slots", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await busySlotsService.listBusySlotsForViewer(req.auth!.role, req.auth!.sub);
  res.json(rows);
});

busySlotsRouter.post("/busy-slots", requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "INTERPRETER") {
    res.status(403).json({ error: "Only interpreters can add availability blocks" });
    return;
  }
  const parsed = createBusySlotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { startTime, endTime, reason } = parsed.data;
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (!(start < end)) {
    res.status(400).json({ error: "startTime must be before endTime" });
    return;
  }
  const slot = await busySlotsService.createBusySlotForInterpreter(req.auth!.sub, start, end, reason);
  res.status(201).json(slot);
});

busySlotsRouter.delete("/busy-slots/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const result = await busySlotsService.deleteBusySlotForViewer(id, req.auth!.role, req.auth!.sub);
  if (!result.deleted) {
    res.status(result.reason === "not_found" ? 404 : 403).json({ error: "Cannot delete this block" });
    return;
  }
  res.status(204).send();
});
