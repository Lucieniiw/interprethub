import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";

import { createApp } from "./app.js";
import { getCorsOrigin } from "./lib/cors.js";
import { assertRequiredEnv } from "./lib/env.js";
import { verifyToken } from "./lib/jwt.js";
import { startReminderDispatchScheduler } from "./services/reminder-dispatch.service.js";

/**
 * Force absolute path so PM2 NEVER breaks env loading
 */
dotenv.config({
  path: "/var/www/interprethub/.env",
});

assertRequiredEnv();

const port = Number(process.env.PORT ?? 8082);

const httpServer = http.createServer();

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: getCorsOrigin(),
    credentials: true,
  },
});

const app = createApp(io);

httpServer.on("request", app);

/**
 * Single error handler
 */
httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[api] Port ${port} already in use`);
  } else {
    console.error("[api] HTTP server error:", err);
  }
  process.exit(1);
});

/**
 * Socket auth middleware
 */
io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;

  if (!token) {
    return next(new Error("Unauthorized"));
  }

  try {
    const payload = verifyToken(token);
    socket.data.userId = payload.sub;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
}); // ✅ FIXED: missing closure was critical

io.on("connection", (socket) => {
  socket.join(`user:${socket.data.userId}`);
  socket.emit("hello", { message: "Socket connected" });
});

/**
 * Start server
 */
httpServer.listen(port, () => {
  console.log(`API + Socket.IO listening on http://localhost:${port}`);

  // safer startup (prevents Prisma race issues)
  setTimeout(() => {
    startReminderDispatchScheduler();
  }, 3000);
});
