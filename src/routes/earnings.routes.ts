import { Router } from "express";
import { patchEarningStaffSchema } from "@interpret-hub/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.middleware.js";
import * as earningsService from "../services/earnings.service.js";

export const earningsRouter = Router();

earningsRouter.get("/earnings", requireAuth, async (req: AuthedRequest, res) => {
  const range = earningsService.parseEarningsRangeQuery(req.query.range);
  const rows = await earningsService.listEarningsForViewer(req.auth!.role, req.auth!.sub, range);
  res.json(rows);
});

earningsRouter.get("/earnings/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const row = await earningsService.getEarningDetailForViewer(id, req.auth!.role, req.auth!.sub);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

earningsRouter.patch("/earnings/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = patchEarningStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const row = await earningsService.updateEarningForStaff(id, req.auth!.role, parsed.data);
  if (!row) {
    res.status(req.auth!.role === "INTERPRETER" ? 403 : 404).json({ error: "Not found or forbidden" });
    return;
  }
  res.json(row);
});
