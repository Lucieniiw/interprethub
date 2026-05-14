import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth.middleware.js";
import * as notificationsService from "../services/notifications.service.js";

export const notificationsRouter = Router();

notificationsRouter.get("/notifications", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await notificationsService.listForUser(req.auth!.sub, 50);
  res.json(rows);
});

notificationsRouter.get("/notifications/unread-count", requireAuth, async (req: AuthedRequest, res) => {
  const count = await notificationsService.unreadCount(req.auth!.sub);
  res.json({ count });
});

notificationsRouter.patch("/notifications/:id/read", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const row = await notificationsService.markRead(id, req.auth!.sub);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

notificationsRouter.post("/notifications/read-all", requireAuth, async (req: AuthedRequest, res) => {
  await notificationsService.markAllRead(req.auth!.sub);
  res.status(204).send();
});
