import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import type { AuthedRequest } from "../middleware/auth.middleware.js";

export const PROFILE_PHOTO_PUBLIC_PREFIX = "/uploads/profile-photos";

export const PROFILE_PHOTO_DIR = path.join(process.cwd(), "uploads", "profile-photos");

fs.mkdirSync(PROFILE_PHOTO_DIR, { recursive: true });

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

export function unlinkIfUploadedPhoto(stored: string | null | undefined): void {
  const abs = resolveUploadedPhotoAbsolutePath(stored);
  if (!abs) return;
  try {
    fs.unlinkSync(abs);
  } catch {
    /* ignore missing file */
  }
}

export function resolveUploadedPhotoAbsolutePath(stored: string | null | undefined): string | null {
  if (!stored?.startsWith(`${PROFILE_PHOTO_PUBLIC_PREFIX}/`)) return null;
  const name = path.basename(stored);
  /** New files: `{randomHex24}-{timestamp}`; legacy: `{userId}-{timestamp}` */
  const okNew = /^[a-f0-9]{24}-\d+\.(jpe?g|png|gif|webp)$/i.test(name);
  const okLegacy = /^\d+-\d+\.(jpe?g|png|gif|webp)$/i.test(name);
  if (!okNew && !okLegacy) return null;
  return path.join(PROFILE_PHOTO_DIR, name);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, PROFILE_PHOTO_DIR);
  },
  filename: (req, file, cb) => {
    const auth = (req as AuthedRequest).auth;
    if (!auth) {
      cb(new Error("Unauthorized"), "");
      return;
    }
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = ALLOWED_EXT.has(ext) ? ext : ".jpg";
    const rand = crypto.randomBytes(12).toString("hex");
    cb(null, `${rand}-${Date.now()}${safe}`);
  },
});

export const profilePhotoUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    cb(null, ok);
  },
});
