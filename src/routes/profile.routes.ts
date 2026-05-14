import { Router } from "express";
import path from "path";
import fs from "fs";
import { updateProfileSchema } from "@interpret-hub/shared";
import { validateProfilePhotoMagicBytes } from "../lib/file-signature.js";
import { profilePhotoUpload } from "../lib/profile-photo-storage.js";
import { decorateUserForClient } from "../lib/upload-response-decoration.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.middleware.js";
import * as profileService from "../services/profile.service.js";

export const profileRouter = Router();

profileRouter.get("/profile", requireAuth, async (req: AuthedRequest, res) => {
  const user = await profileService.getFullProfile(req.auth!.sub);
  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const { passwordHash: _, ...safe } = user;
  const out = { ...safe } as Record<string, unknown>;
  decorateUserForClient(out);
  res.json(out);
});

profileRouter.patch("/profile", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const user = await profileService.updateMyProfile(req.auth!.sub, parsed.data);
  const { passwordHash: _, ...safe } = user;
  const out = { ...safe } as Record<string, unknown>;
  decorateUserForClient(out);
  res.json(out);
});

profileRouter.post(
  "/profile/photo",
  requireAuth,
  profilePhotoUpload.single("photo"),
  async (req: AuthedRequest, res) => {
    try {
      if (!req.file?.filename) {
        res.status(400).json({ error: "No image file received. Use field name \"photo\" (JPEG, PNG, GIF, or WebP, max 2 MB)." });
        return;
      }
      const ext = path.extname(req.file.originalname ?? "").toLowerCase();
      if (req.file.path && !validateProfilePhotoMagicBytes(req.file.path, ext)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          /* ignore */
        }
        res.status(400).json({ error: "File content does not match an allowed image type." });
        return;
      }
      const user = await profileService.setUploadedProfilePhoto(req.auth!.sub, req.file.filename);
      const { passwordHash: _, ...safe } = user;
      const out = { ...safe } as Record<string, unknown>;
      decorateUserForClient(out);
      res.json(out);
    } catch (err) {
      console.error("[POST /profile/photo]", err);
      res.status(500).json({ error: "Could not save photo." });
    }
  },
);

profileRouter.delete("/profile/photo", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await profileService.clearProfilePhoto(req.auth!.sub);
    const { passwordHash: _, ...safe } = user;
    const out = { ...safe } as Record<string, unknown>;
    decorateUserForClient(out);
    res.json(out);
  } catch (err) {
    console.error("[DELETE /profile/photo]", err);
    res.status(500).json({ error: "Could not remove photo." });
  }
});

profileRouter.patch("/profile/rates", requireAuth, (_req: AuthedRequest, res) => {
  res.status(403).json({ error: "Pay rates can only be updated by administrators (User Management)." });
});
