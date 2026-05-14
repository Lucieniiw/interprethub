import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth.middleware.js";
import * as reportsService from "../services/reports.service.js";

export const reportsRouter = Router();

reportsRouter.get("/reports/jobs-for-export", requireAuth, async (req: AuthedRequest, res) => {
  const role = req.auth!.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Coordinator access required" });
    return;
  }

  const minRaw = req.query.startTimeMin;
  const maxRaw = req.query.startTimeMax;
  if (typeof minRaw !== "string" || typeof maxRaw !== "string") {
    res.status(400).json({ error: "startTimeMin and startTimeMax are required (ISO 8601)." });
    return;
  }

  const start = new Date(minRaw);
  const end = new Date(maxRaw);

  try {
    const bundle = await reportsService.getStaffExportBundle(start, end);
    res.json({
      jobs: bundle.jobs,
      truncated: bundle.truncated,
      pendingReviewUnpaidCount: bundle.pendingReviewUnpaidCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load jobs for export.";
    res.status(400).json({ error: message });
  }
});
