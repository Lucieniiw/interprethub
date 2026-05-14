import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { isAxiosError } from "axios";
import { loginSchema } from "@interpret-hub/shared";
import { api } from "@/services/api/http-client";
import { type AuthUser, useAuth } from "@/features/auth/model/auth-context";
import { SessionSpinner } from "@/router/SessionSpinner";
import styles from "./LoginPage.module.css";

export type LoginPortal = "linguist" | "coordinator";

function isStaffRole(role: AuthUser["role"]) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function loginFailureMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const raw = err.response?.data;
    if (typeof raw === "string" && raw.trim()) {
      const trimmed = raw.trim();
      if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
        return `Login failed (HTTP ${err.response?.status ?? "?"}). The API returned an HTML error page instead of JSON — check that the API is running, the URL/port matches your setup (VITE_API_URL or Vite proxy), and server logs for this request.`;
      }
      return trimmed.length > 280 ? `${trimmed.slice(0, 280)}…` : trimmed;
    }
    const data = raw as Record<string, unknown> | undefined;
    if (data && typeof data === "object") {
      if (typeof data.error === "string" && data.error.trim()) return data.error;
      if (typeof data.message === "string" && data.message.trim()) return data.message;
      if (data.error !== undefined && typeof data.error === "object") {
        return "Invalid email or password format.";
      }
    }
    if (err.code === "ERR_NETWORK" || err.message === "Network Error") {
      return "Cannot reach the API. Start the server and check the dev proxy port (e.g. client/.env.development).";
    }
    if (err.response?.status === 401) return "Invalid email or password.";
    if (err.response?.status) return `Login failed (HTTP ${err.response.status}).`;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Login failed.";
}

type Props = {
  portal: LoginPortal;
  title: string;
  subtitle: string;
  wrapExtraClass?: string;
  cardExtraClass?: string;
  alternateSignIn?: { label: string; to: string };
};

export function LoginFormCard({
  portal,
  title,
  subtitle,
  wrapExtraClass,
  cardExtraClass,
  alternateSignIn,
}: Props) {
  const { token, user, setToken, setUser, sessionReady } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!sessionReady) {
    return <SessionSpinner />;
  }

  if (token && user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError("Enter a valid email and password.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post<{ token: string; user: AuthUser }>("/api/auth/login", parsed.data);

      if (!data?.token || !data?.user) {
        setError("Unexpected response from server. Try again.");
        return;
      }

      if (portal === "linguist" && data.user.role !== "INTERPRETER") {
        setError(
          "That account is not a linguist profile. Coordinators should use the coordinator sign-in page.",
        );
        return;
      }
      if (portal === "coordinator" && !isStaffRole(data.user.role)) {
        setError(
          "That account is for linguists. Use the linguist sign-in page to open your portal.",
        );
        return;
      }

      setToken(data.token);
      setUser(data.user);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      setError(loginFailureMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={[styles.wrap, wrapExtraClass].filter(Boolean).join(" ")}>
      <div className={[styles.card, cardExtraClass].filter(Boolean).join(" ")}>
        <Link className={styles.backToPortal} to="/login">
          ← Choose portal
        </Link>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.sub}>{subtitle}</p>
        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
            />
          </label>
          <label className={styles.label}>
            Password
            <input
              className={styles.input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              required
            />
          </label>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button className={styles.submit} type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        {alternateSignIn ? (
          <p className={styles.altSignIn}>
            <Link to={alternateSignIn.to}>{alternateSignIn.label}</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
