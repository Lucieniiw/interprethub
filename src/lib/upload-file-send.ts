import fs from "fs";
import path from "path";
import type { Response } from "express";
import { JOB_ATTACHMENT_DIR, JOB_ATTACHMENT_PUBLIC_PREFIX } from "./job-attachment-storage.js";
import { PROFILE_PHOTO_DIR, PROFILE_PHOTO_PUBLIC_PREFIX } from "./profile-photo-storage.js";
import { verifyUploadReadToken } from "./upload-read-token.js";

function mimeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".zip":
      return "application/zip";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case ".ppt":
      return "application/vnd.ms-powerpoint";
    case ".pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    default:
      return "application/octet-stream";
  }
}

export function resolveUploadFileAbsolute(publicPath: string): string | null {
  const norm = publicPath.replace(/\\/g, "/");
  if (norm.includes("..")) return null;
  const base = path.posix.basename(norm);
  if (!base) return null;
  if (norm.startsWith(`${JOB_ATTACHMENT_PUBLIC_PREFIX}/`)) {
    return path.join(JOB_ATTACHMENT_DIR, base);
  }
  if (norm.startsWith(`${PROFILE_PHOTO_PUBLIC_PREFIX}/`)) {
    return path.join(PROFILE_PHOTO_DIR, base);
  }
  return null;
}

export function sendVerifiedUploadFile(publicPath: string, res: Response): void {
  const abs = resolveUploadFileAbsolute(publicPath);
  if (!abs || !fs.existsSync(abs)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const ext = path.extname(abs);
  res.setHeader("Content-Type", mimeFromExt(ext));
  res.setHeader("X-Content-Type-Options", "nosniff");
  const inline = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf"].includes(ext.toLowerCase());
  res.setHeader("Content-Disposition", inline ? "inline" : "attachment");
  res.sendFile(abs, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ error: "Could not read file" });
    }
  });
}

export function handleUploadReadQuery(token: string | undefined, res: Response): void {
  if (!token?.trim()) {
    res.status(400).json({ error: "Missing token" });
    return;
  }
  const verified = verifyUploadReadToken(token);
  if (!verified) {
    res.status(403).json({ error: "Invalid or expired link" });
    return;
  }
  sendVerifiedUploadFile(verified.path, res);
}
