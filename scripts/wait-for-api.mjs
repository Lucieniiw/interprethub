/**
 * Blocks until this repo's API responds on `/api/healthz` (from InterpretHub `.env` PORT),
 * so Vite does not start while the port is held by another app or before Express is ready.
 */
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import waitOn from "wait-on";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env"), override: true });

const port = Number(process.env.PORT ?? 8082);
const host = "127.0.0.1";
const url = `http://${host}:${port}/api/healthz`;
await waitOn({
  resources: [url],
  timeout: 120_000,
  interval: 250,
});
process.stderr.write(`[wait-for-api] ${url} OK\n`);
