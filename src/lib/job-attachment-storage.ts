import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";

export const JOB_ATTACHMENT_PUBLIC_PREFIX = "/uploads/job-attachments";
export const JOB_ATTACHMENT_DIR = path.join(process.cwd(), "uploads", "job-attachments");

fs.mkdirSync(JOB_ATTACHMENT_DIR, { recursive: true });

/** Allowed extensions for uploaded job briefs / references */
const ALLOWED_EXT = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".zip",
]);

export function unlinkUploadedJobAttachment(filename: string | undefined): void {
  if (!filename || !/^[\w.-]+$/.test(filename)) return;
  const abs = path.join(JOB_ATTACHMENT_DIR, filename);
  try {
    fs.unlinkSync(abs);
  } catch {
    /* ignore */
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, JOB_ATTACHMENT_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = ALLOWED_EXT.has(ext) ? ext : ".bin";
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${safe}`);
  },
});

export const jobAttachmentUpload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      cb(new Error(`Unsupported file type (${ext || "unknown"}).`));
      return;
    }
    cb(null, true);
  },
});
