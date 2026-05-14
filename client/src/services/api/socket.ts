import { io, type Socket } from "socket.io-client";

const base =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ??
  `${typeof window !== "undefined" ? window.location.origin : ""}`;

export function createAuthenticatedSocket(token: string): Socket {
  return io(base, {
    path: "/socket.io",
    auth: { token },
    transports: ["websocket", "polling"],
    autoConnect: true,
  });
}
