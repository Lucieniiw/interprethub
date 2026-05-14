import { Router } from "express";
import rateLimit from "express-rate-limit";
import { handleUploadReadQuery } from "../lib/upload-file-send.js";

export const uploadsReadRouter = Router();

const readLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many file requests. Try again shortly." },
});

uploadsReadRouter.get("/uploads/read", readLimiter, (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : undefined;
  handleUploadReadQuery(token, res);
});
