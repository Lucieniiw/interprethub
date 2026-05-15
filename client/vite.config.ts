import path from "path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const proxyTarget =
    env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8082";

  return {
    plugins: [react()],

    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },

    server: {
      proxy: {
        "/auth": { target: proxyTarget, changeOrigin: true },
        "/jobs": { target: proxyTarget, changeOrigin: true },
        "/users": { target: proxyTarget, changeOrigin: true },
        "/clients": { target: proxyTarget, changeOrigin: true },
        "/notifications": { target: proxyTarget, changeOrigin: true },
        "/earnings": { target: proxyTarget, changeOrigin: true },
        "/busy-slots": { target: proxyTarget, changeOrigin: true },
        "/availability": { target: proxyTarget, changeOrigin: true },

        "/socket.io": {
          target: proxyTarget,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
