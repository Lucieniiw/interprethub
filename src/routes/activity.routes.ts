import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth.middleware.js";
import * as activityService from "../services/activity.service.js";

export const activityRouter = Router();

activityRouter.get("/activity", requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "ADMIN" && req.auth!.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Coordinator access required" });
    return;
  }
  const take = Math.min(Number(req.query.take) || 80, 200);
  const rows = await activityService.listActivityForStaff(take);
  res.json(rows);
});
