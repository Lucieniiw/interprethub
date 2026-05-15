import { io, type Socket } from "socket.io-client";

// ALWAYS use relative path (proxy will handle it)
const base =
  typeof window !== "undefined"
    ? window.location.origin
    : "";

export function createAuthenticatedSocket(token: string): Socket {
  return io(base, {
    path: "/socket.io",
    auth: { token },
    transports: ["websocket", "polling"],
  });
}
