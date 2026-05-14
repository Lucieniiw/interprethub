import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { Server as IoServer } from "socket.io";
import { getCorsOrigin } from "./lib/cors.js";
import { emailRouter } from "./routes/email.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { createJobsRouter } from "./routes/jobs.routes.js";
import { earningsRouter } from "./routes/earnings.routes.js";
import { busySlotsRouter } from "./routes/busy-slots.routes.js";
import { clientsRouter } from "./routes/clients.routes.js";
import { usersRouter } from "./routes/users.routes.js";
import { notificationsRouter } from "./routes/notifications.routes.js";
import { activityRouter } from "./routes/activity.routes.js";
import { reportsRouter } from "./routes/reports.routes.js";
import { settingsRouter } from "./routes/settings.routes.js";
import { profileRouter } from "./routes/profile.routes.js";
import { uploadsReadRouter } from "./routes/uploads-read.routes.js";

const apiGlobalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const u = req.originalUrl || req.url || "";
    return (
      u.includes("/healthz") ||
      u.includes("/auth/login") ||
      u.includes("/uploads/read") ||
      u.includes("/jobs/email-action")
    );
  },
  message: { error: "Too many requests. Please slow down." },
});

export function createApp(io: IoServer | null) {
  const app = express();
  const origin = getCorsOrigin();
  const prod = process.env.NODE_ENV === "production";

  if (process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      ...(prod
        ? {
            strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true, preload: false },
          }
        : {}),
    }),
  );
  app.use(cors({ origin, credentials: true }));
  app.use(express.json({ limit: "2mb" }));

  /** Signed file reads (job attachments, profile photos). Public `/uploads` static hosting removed. */
  app.use("/api", uploadsReadRouter);
  app.use("/api", apiGlobalLimiter);

  app.use("/api", healthRouter);
  app.use("/api", emailRouter);
  app.use("/api", authRouter);
  app.use("/api", dashboardRouter);
  app.use("/api", earningsRouter);
  app.use("/api", busySlotsRouter);
  app.use("/api", clientsRouter);
  app.use("/api", usersRouter);
  app.use("/api", notificationsRouter);
  app.use("/api", activityRouter);
  app.use("/api", reportsRouter);
  app.use("/api", settingsRouter);
  app.use("/api", profileRouter);
  app.use("/api", createJobsRouter(io));

  /** Body-parser JSON syntax errors and uncaught route errors — always JSON (never HTML) so clients can show `error`. */
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    const status =
      err && typeof err === "object" && err !== null && "status" in err
        ? Number((err as { status: unknown }).status)
        : NaN;
    const looksLikeJsonBodyParse =
      status === 400 && err && typeof err === "object" && err !== null && "body" in err;

    if (looksLikeJsonBodyParse) {
      res.status(400).json({ error: "Invalid JSON in request body." });
      return;
    }

    console.error("[express]", err);
    const dev = process.env.NODE_ENV !== "production";
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({
      error: dev ? message : "Something went wrong. Try again or contact support.",
    });
  });

  return app;
}
