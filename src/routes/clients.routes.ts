import { Router } from "express";
import { createClientSchema, updateClientSchema } from "@interpret-hub/shared";
import { enrichClientResponse } from "../lib/client-rate-display.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.middleware.js";
import * as clientsService from "../services/clients.service.js";

export const clientsRouter = Router();

function requireStaff(req: AuthedRequest, res: import("express").Response): boolean {
  if (req.auth!.role !== "ADMIN" && req.auth!.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Coordinator access required" });
    return false;
  }
  return true;
}

clientsRouter.get("/clients", requireAuth, async (req: AuthedRequest, res) => {
  if (!requireStaff(req, res)) return;
  const rows = await clientsService.listClients();
  res.json(rows.map(enrichClientResponse));
});

clientsRouter.post("/clients", requireAuth, async (req: AuthedRequest, res) => {
  if (!requireStaff(req, res)) return;
  const parsed = createClientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const client = await clientsService.createClient(parsed.data);
  res.status(201).json(enrichClientResponse(client));
});

clientsRouter.delete("/clients/:id", requireAuth, async (req: AuthedRequest, res) => {
  if (!requireStaff(req, res)) return;
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const result = await clientsService.deleteClient(id);
  if (!result.deleted) {
    res.status(409).json({ error: "Client has assignments — reassign or delete jobs first." });
    return;
  }
  res.status(204).send();
});

clientsRouter.patch("/clients/:id", requireAuth, async (req: AuthedRequest, res) => {
  if (!requireStaff(req, res)) return;
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = updateClientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const client = await clientsService.updateClient(id, parsed.data);
    res.json(enrichClientResponse(client));
  } catch {
    res.status(404).json({ error: "Client not found" });
  }
});
