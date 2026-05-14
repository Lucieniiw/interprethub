import { config as loadEnv } from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { createApp } from "./app.js";
import { getCorsOrigin } from "./lib/cors.js";
import { assertRequiredEnv } from "./lib/env.js";
import { verifyToken } from "./lib/jwt.js";
import { startReminderDispatchScheduler } from "./services/reminder-dispatch.service.js";

loadEnv({ override: process.env.NODE_ENV === "production" ? false : true });
assertRequiredEnv();

const port = Number(process.env.PORT ?? 8082);

const httpServer = http.createServer();
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: getCorsOrigin(),
    credentials: true,
  },
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    next(new Error("Unauthorized"));
    return;
  }
  try {
    const payload = verifyToken(token);
    socket.data.userId = payload.sub;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.data.userId}`);
  socket.emit("hello", { message: "Socket connected" });
});

const app = createApp(io);
httpServer.on("request", app);

httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[api] Port ${port} is already in use. Stop the other process (e.g. a duplicate \`pnpm run dev\`, old Node/tsx, or another app on this port), or set PORT to a free value in .env and match \`client/.env.development\` VITE_API_PROXY_TARGET (or remove that line so Vite derives the proxy from PORT).`,
    );
  } else {
    console.error("[api] HTTP server error:", err);
  }
  process.exit(1);
});

httpServer.listen(port, () => {
  console.log(`API + Socket.IO listening on http://localhost:${port}`);
  startReminderDispatchScheduler();
});
