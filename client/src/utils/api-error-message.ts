import { isAxiosError } from "axios";

/** Prefer API `{ error: string }`, then network hints; fallback for generic copy. */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data;
    if (data && typeof data === "object" && data !== null && "error" in data) {
      const e = (data as { error: unknown }).error;
      if (typeof e === "string") return e;
    }
    if (err.code === "ERR_NETWORK" || err.message === "Network Error") {
      return `${fallback} If you use the Vite dev server, ensure the API is running and client/.env.development VITE_API_PROXY_TARGET matches the API port (see root .env PORT).`;
    }
    if (err.response?.status === 401) {
      return "Your session expired. Sign in again.";
    }
  }
  return fallback;
}
