import fs from "fs";

const MAX_PROBE = 64;

/** Basic magic-byte checks for uploaded job attachments (extension is not enough). */
export function validateJobAttachmentMagicBytes(absPath: string, extLower: string): boolean {
  let buf: Buffer;
  try {
    const fd = fs.openSync(absPath, "r");
    try {
      buf = Buffer.alloc(MAX_PROBE);
      const n = fs.readSync(fd, buf, 0, MAX_PROBE, 0);
      buf = buf.subarray(0, n);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
  if (buf.length < 4) return false;

  if (extLower === ".txt") {
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] === 0) return false;
    }
    return true;
  }

  if (extLower === ".pdf") {
    return buf.subarray(0, 4).toString("ascii") === "%PDF";
  }
  if (extLower === ".png") {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  if (extLower === ".jpg" || extLower === ".jpeg") {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (extLower === ".gif") {
    const h = buf.subarray(0, 6).toString("ascii");
    return h === "GIF87a" || h === "GIF89a";
  }
  if (extLower === ".webp") {
    if (buf.length < 12) return false;
    const riff = buf.subarray(0, 4).toString("ascii");
    const webp = buf.subarray(8, 12).toString("ascii");
    return riff === "RIFF" && webp === "WEBP";
  }
  if (
    extLower === ".zip" ||
    extLower === ".docx" ||
    extLower === ".xlsx" ||
    extLower === ".pptx"
  ) {
    return buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) && (buf[3] === 0x04 || buf[3] === 0x06 || buf[3] === 0x08);
  }
  if (extLower === ".doc" || extLower === ".ppt") {
    const ole = buf.subarray(0, 8);
    return ole[0] === 0xd0 && ole[1] === 0xcf && ole[2] === 0x11 && ole[3] === 0xe0;
  }

  return false;
}

/** Profile photos: JPEG, PNG, GIF, WebP only (matches upload filter). */
export function validateProfilePhotoMagicBytes(absPath: string, extLower: string): boolean {
  const e = extLower.toLowerCase();
  if (e !== ".jpg" && e !== ".jpeg" && e !== ".png" && e !== ".gif" && e !== ".webp") return false;
  return validateJobAttachmentMagicBytes(absPath, e);
}
