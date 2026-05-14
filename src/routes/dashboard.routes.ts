import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth.middleware.js";
import * as dashboardService from "../services/dashboard.service.js";

export const dashboardRouter = Router();

dashboardRouter.get("/dashboard/stats", requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "ADMIN" && req.auth!.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Coordinator access required" });
    return;
  }
  const counts = await dashboardService.getJobCountsByStatus();
  res.json({
    jobs: counts,
  });
});

dashboardRouter.get("/dashboard/overview", requireAuth, async (req: AuthedRequest, res) => {
  const role = req.auth!.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Coordinator access required" });
    return;
  }
  const overview = await dashboardService.getDashboardOverview();
  res.json(overview);
});
