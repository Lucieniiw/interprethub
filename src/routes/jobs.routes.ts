import { Router, type IRouter } from "express";
import type { Request, RequestHandler, Response } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import { JobOperationalStatus } from "#prisma-client";
import {
  completeJobInterpreterSchema,
  createJobSchema,
  formatJobReference,
  updateJobStaffSchema,
} from "@interpret-hub/shared";
import {
  JOB_ATTACHMENT_PUBLIC_PREFIX,
  jobAttachmentUpload,
  unlinkUploadedJobAttachment,
} from "../lib/job-attachment-storage.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.middleware.js";
import type { Server as IoServer } from "socket.io";
import { emailActionConfirmHtml, emailActionResultHtml, sendEmailActionHtml } from "../lib/email-action-page.js";
import { verifyJobActionToken, type JobActionTokenPayload } from "../lib/jwt.js";
import { publicBrowserOrigin } from "../lib/public-url.js";
import { validateJobAttachmentMagicBytes } from "../lib/file-signature.js";
import { decorateJobForClient } from "../lib/upload-response-decoration.js";
import * as jobInterpreterEmail from "../services/job-interpreter-email.service.js";
import * as jobRequesterEmail from "../services/job-requester-email.service.js";
import * as jobsService from "../services/jobs.service.js";

function parseMultipartJobPayload(req: AuthedRequest): Record<string, unknown> | null {
  const raw = (req.body as { payload?: unknown }).payload;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const multipartJobUpload: RequestHandler = (req, res, next) => {
  const ct = req.headers["content-type"] ?? "";
  if (!ct.includes("multipart/form-data")) {
    next();
    return;
  }
  jobAttachmentUpload.single("attachment")(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Invalid upload" });
      return;
    }
    next();
  });
};

const emailActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts on email links. Try again later." },
});

const parseEmailActionPostBody: RequestHandler = (req, res, next) => {
  const ct = req.headers["content-type"] ?? "";
  if (ct.includes("application/json")) {
    express.json({ limit: "24kb" })(req, res, next);
  } else {
    express.urlencoded({ extended: false, limit: "24kb" })(req, res, next);
  }
};

function readEmailActionTokenFromRequest(req: Request): string {
  const fromBody =
    req.body &&
    typeof req.body === "object" &&
    typeof (req.body as { token?: unknown }).token === "string"
      ? (req.body as { token: string }).token
      : "";
  return fromBody.trim();
}

async function runJobEmailAction(
  payload: JobActionTokenPayload,
  io: IoServer | null,
  res: Response,
): Promise<void> {
  try {
    if (payload.act === "claim") {
      const claim = await jobsService.claimJob(payload.jobId, payload.interpreterId);
      if (!claim.ok) {
        sendEmailActionHtml(
          res,
          409,
          emailActionResultHtml({
            title: "Could not claim",
            message:
              "This assignment may already be assigned to someone else or is no longer open.",
            ok: false,
          }),
        );
        return;
      }
      io?.emit("job:updated", { action: "claimed", jobId: payload.jobId });
      const jobLabel = formatJobReference(claim.job);
      sendEmailActionHtml(
        res,
        200,
        emailActionResultHtml({
          title: "Assignment claimed",
          message: `You’re assigned to job ${jobLabel}. Open the app for full details.`,
          ok: true,
        }),
      );
      return;
    }

    if (payload.act === "decline") {
      const result = await jobsService.declineJob(payload.jobId, payload.interpreterId);
      if (!result.ok) {
        sendEmailActionHtml(
          res,
          409,
          emailActionResultHtml({
            title: "Could not decline",
            message: "This assignment may no longer be open.",
            ok: false,
          }),
        );
        return;
      }
      io?.emit("job:updated", { action: "declined", jobId: payload.jobId });
      sendEmailActionHtml(
        res,
        200,
        emailActionResultHtml({
          title: "Declined",
          message: "You won’t be offered this assignment again. Other linguists can still claim it.",
          ok: true,
        }),
      );
      return;
    }

    sendEmailActionHtml(
      res,
      400,
      emailActionResultHtml({
        title: "Invalid action",
        message: "This link is not valid.",
        ok: false,
      }),
    );
  } catch (err) {
    console.error("[POST /jobs/email-action]", err);
    sendEmailActionHtml(
      res,
      500,
      emailActionResultHtml({
        title: "Something went wrong",
        message: "Please try again or sign in to InterpreterHub.",
        ok: false,
      }),
    );
  }
}

export function createJobsRouter(io: IoServer | null): IRouter {
  const router = Router();

  const postUrl = `${publicBrowserOrigin().replace(/\/$/, "")}/api/jobs/email-action`;

  /**
   * Signed links from email — GET shows a confirmation page (no side effect).
   * POST completes claim or decline (avoids link prefetch / mail scanner side effects on GET).
   */
  router.get("/jobs/email-action", emailActionLimiter, async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token.trim()) {
      sendEmailActionHtml(
        res,
        400,
        emailActionResultHtml({
          title: "Invalid link",
          message: "This link is missing required information.",
          ok: false,
        }),
      );
      return;
    }

    let payload: JobActionTokenPayload;
    try {
      payload = verifyJobActionToken(token);
    } catch {
      sendEmailActionHtml(
        res,
        400,
        emailActionResultHtml({
          title: "Link expired or invalid",
          message:
            "Ask your coordinator for a new assignment email, or sign in to InterpreterHub to view open assignments.",
          ok: false,
        }),
      );
      return;
    }

    sendEmailActionHtml(
      res,
      200,
      emailActionConfirmHtml({
        act: payload.act,
        jobId: payload.jobId,
        token,
        postUrl,
      }),
    );
  });

  router.post(
    "/jobs/email-action",
    emailActionLimiter,
    parseEmailActionPostBody,
    async (req, res) => {
      const token = readEmailActionTokenFromRequest(req);
      if (!token) {
        sendEmailActionHtml(
          res,
          400,
          emailActionResultHtml({
            title: "Invalid request",
            message: "Missing token. Open the link from your email again.",
            ok: false,
          }),
        );
        return;
      }

      let payload: JobActionTokenPayload;
      try {
        payload = verifyJobActionToken(token);
      } catch {
        sendEmailActionHtml(
          res,
          400,
          emailActionResultHtml({
            title: "Link expired or invalid",
            message:
              "Ask your coordinator for a new assignment email, or sign in to InterpreterHub to view open assignments.",
            ok: false,
          }),
        );
        return;
      }

      await runJobEmailAction(payload, io, res);
    },
  );

  router.get("/jobs", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const jobs = await jobsService.listJobsForViewer(req.auth!.role, req.auth!.sub);
      res.json(jobs);
    } catch (err) {
      console.error("[GET /jobs]", err);
      const message =
        err instanceof Error ? err.message : typeof err === "string" ? err : "Could not load assignments.";
      const hint =
        process.env.NODE_ENV !== "production" &&
        (message.includes("does not exist") || message.includes("Unknown column"))
          ? " Apply pending database migrations (e.g. `pnpm exec prisma migrate deploy`)."
          : "";
      const genHint =
        process.env.NODE_ENV !== "production" &&
        (message.includes("Unknown argument") ||
          message.includes("PrismaClientValidationError") ||
          message.includes("operationalStatus") ||
          message.includes("billingStatus"))
          ? " Regenerate the Prisma client to match the schema: `pnpm run db:generate` (or `pnpm run db:deploy` after migrations), then restart the API."
          : "";
      res.status(500).json({
        error:
          process.env.NODE_ENV === "production"
            ? "Could not load assignments."
            : `${message}${hint}${genHint}`,
      });
    }
  });

  router.post("/jobs", requireAuth, multipartJobUpload, async (req: AuthedRequest, res) => {
    if (req.auth!.role === "INTERPRETER") {
      res.status(403).json({ error: "Interpreters cannot create assignments" });
      return;
    }

    const ct = req.headers["content-type"] ?? "";
    let body: Record<string, unknown> | null = null;
    if (ct.includes("multipart/form-data")) {
      body = parseMultipartJobPayload(req);
      if (!body) {
        unlinkUploadedJobAttachment(req.file?.filename);
        res.status(400).json({ error: "Missing or invalid payload JSON" });
        return;
      }
    } else {
      body =
        typeof req.body === "object" && req.body !== null ? { ...(req.body as object) } : null;
    }

    if (!body) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }

    if (body.requesterEmail === "") body.requesterEmail = null;

    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      unlinkUploadedJobAttachment(req.file?.filename);
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const file = req.file;

    try {
      let job = await jobsService.createJobFromPayload(parsed.data);
      if (file?.filename && file.path) {
        const ext = path.extname(file.originalname ?? "").toLowerCase();
        if (!validateJobAttachmentMagicBytes(file.path, ext)) {
          unlinkUploadedJobAttachment(file.filename);
          res.status(400).json({
            error: "File content does not match the allowed type for this extension.",
          });
          return;
        }
        const publicPath = `${JOB_ATTACHMENT_PUBLIC_PREFIX}/${file.filename}`;
        job = await jobsService.attachFileToJob(job.id, publicPath);
      }
      await jobRequesterEmail.notifyRequesterJobCreated(job);
      if (
        job.operationalStatus === JobOperationalStatus.OPEN ||
        job.operationalStatus === JobOperationalStatus.OFFERED
      ) {
        void jobInterpreterEmail.notifyInterpretersJobPublished(job).catch((e) =>
          console.error("[POST /jobs] interpreter broadcast email failed", e),
        );
      }
      io?.emit("job:updated", { action: "created", jobId: job.id });
      decorateJobForClient(job as unknown as Record<string, unknown>);
      res.status(201).json(job);
    } catch (err) {
      unlinkUploadedJobAttachment(file?.filename);
      console.error("[POST /jobs]", err);
      res.status(500).json({ error: "Could not create assignment." });
    }
  });

  router.post("/jobs/:id/claim", requireAuth, async (req: AuthedRequest, res) => {
    if (req.auth!.role !== "INTERPRETER") {
      res.status(403).json({ error: "Only interpreters can claim open jobs" });
      return;
    }
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const claim = await jobsService.claimJob(id, req.auth!.sub);
    if (!claim.ok) {
      if (claim.code === "schedule_conflict") {
        res.status(409).json({
          error: claim.message,
          code: claim.code,
          conflicts: claim.conflicts,
        });
        return;
      }
      res.status(409).json({ error: "Job is not available to claim", code: claim.code });
      return;
    }
    io?.emit("job:updated", { action: "claimed", jobId: id });
    res.json(jobsService.toPublicJob(claim.job as Record<string, unknown>, req.auth!.role));
  });

  router.patch("/jobs/:id", requireAuth, async (req: AuthedRequest, res) => {
    if (req.auth!.role === "INTERPRETER") {
      res.status(403).json({ error: "Coordinators update assignments" });
      return;
    }
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const body =
      typeof req.body === "object" && req.body !== null ? { ...req.body } : req.body;
    if (body && typeof body === "object" && body.requesterEmail === "") {
      body.requesterEmail = null;
    }
    const parsed = updateJobStaffSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const result = await jobsService.updateJobByStaff(id, parsed.data, req.auth!.sub);
    if (!result.ok) {
      if ("notFound" in result) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.status(409).json({ error: result.message });
      return;
    }
    const job = result.job;
    io?.emit("job:updated", { action: "updated", jobId: id });
    decorateJobForClient(job as unknown as Record<string, unknown>);
    res.json(job);
  });

  router.post("/jobs/:id/complete", requireAuth, async (req: AuthedRequest, res) => {
    if (req.auth!.role !== "INTERPRETER") {
      res.status(403).json({ error: "Use PATCH /jobs/:id as coordinator" });
      return;
    }
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = completeJobInterpreterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const result = await jobsService.completeJobByInterpreter(id, req.auth!.sub, parsed.data);
    if (!result.ok) {
      if (result.code === "validation" || result.code === "invalid_status") {
        res.status(400).json({ error: result.message });
        return;
      }
      res.status(403).json({ error: "Not your assignment" });
      return;
    }
    io?.emit("job:updated", { action: "completed", jobId: id });
    res.json(jobsService.toPublicJob(result.job as Record<string, unknown>, req.auth!.role));
  });

  router.post("/jobs/:id/decline", requireAuth, async (req: AuthedRequest, res) => {
    if (req.auth!.role !== "INTERPRETER") {
      res.status(403).json({ error: "Only interpreters can decline" });
      return;
    }
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const result = await jobsService.declineJob(id, req.auth!.sub);
    if (!result.ok) {
      res.status(409).json({ error: "Only open jobs can be declined" });
      return;
    }
    io?.emit("job:updated", { action: "declined", jobId: id });
    res.status(204).send();
  });

  router.get("/jobs/:id/events", requireAuth, async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const ok = await jobsService.assertJobViewable(id, req.auth!.role, req.auth!.sub);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const events = await jobsService.listJobEventsForJob(id);
    res.json(events);
  });

  router.get("/jobs/:id", requireAuth, async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const ok = await jobsService.assertJobViewable(id, req.auth!.role, req.auth!.sub);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const job = await jobsService.getJobWithRelations(id);
    if (!job) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(jobsService.toPublicJob(job as Record<string, unknown>, req.auth!.role));
  });

  return router;
}
