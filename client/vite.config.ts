import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

function cspPluginForProduction(env: Record<string, string>): Plugin {
  return {
    name: "interpret-hub-csp-meta",
    transformIndexHtml(html) {
      const connect: string[] = ["'self'"];
      const api = env.VITE_API_URL?.trim();
      if (api) {
        try {
          const u = new URL(api);
          connect.push(u.origin);
          if (u.protocol === "https:") connect.push(`wss://${u.host}`);
          else connect.push(`ws://${u.host}`);
        } catch {
          connect.push(api);
        }
      }
      const directives = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        `connect-src ${connect.join(" ")}`,
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ];
      const content = directives.join("; ");
      return html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${content}" />`);
    },
  };
}

/** `.env*` is not applied to `process.env` here unless we use `loadEnv` — wrong target causes Vite "http proxy error" for `/api/*`. */
export default defineConfig(({ mode }) => {
  const clientDir = import.meta.dirname;
  const repoRoot = path.resolve(clientDir, "..");
  const env = {
    ...loadEnv(mode, repoRoot, ""),
    ...loadEnv(mode, clientDir, ""),
  };
  /** When unset, proxy to same host/port as the API (root `.env` PORT, default 8082). Use `127.0.0.1` to avoid Windows `localhost` → IPv6 issues. */
  const apiPort =
    env.PORT?.trim() ||
    (typeof process !== "undefined" && process.env.PORT?.trim()) ||
    "8082";
  const proxyTarget =
    env.VITE_API_PROXY_TARGET?.trim() || `http://127.0.0.1:${apiPort}`;

  const devPort = Number.parseInt(env.VITE_DEV_SERVER_PORT ?? "5175", 10);
  const serverPort = Number.isFinite(devPort) && devPort > 0 ? devPort : 5175;

  const plugins: Plugin[] = [react(), tailwindcss()];
  if (mode === "production") {
    plugins.push(cspPluginForProduction(env));
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("recharts")) return "vendor-recharts";
            if (id.includes("@fullcalendar")) return "vendor-fullcalendar";
            if (id.includes("exceljs")) return "vendor-exceljs";
            if (id.includes("socket.io-client")) return "vendor-socket-io";
            if (id.includes("react-datepicker")) return "vendor-datepicker";
            if (id.includes("react-calendar")) return "vendor-react-calendar";
            if (id.includes("react-signature-canvas")) return "vendor-signature";
            return undefined;
          },
        },
      },
    },
    server: {
      port: serverPort,
      strictPort: false,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          configure(proxy) {
            proxy.on("error", (err) => {
              console.error(`[vite-proxy] ${proxyTarget}:`, (err as Error)?.message ?? err);
            });
          },
        },
        "/socket.io": {
          target: proxyTarget,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
