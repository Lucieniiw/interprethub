import { type FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { isAxiosError } from "axios";
import { acceptInviteSchema } from "@interpret-hub/shared";
import { api } from "@/services/api/http-client";
import { type AuthUser, useAuth } from "@/features/auth/model/auth-context";
import styles from "./LoginPage.module.css";

type Preview = { name: string; email: string };

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const { token: existingToken, user, setToken, setUser, sessionReady } = useAuth();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token.trim()) {
      setPreviewError("This link is missing an invitation token. Ask your coordinator for a new invite.");
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    api
      .get<Preview>("/api/auth/invite-preview", { params: { token } })
      .then((r) => {
        if (!cancelled) setPreview(r.data);
      })
      .catch(() => {
        if (!cancelled) setPreviewError("This invitation link is invalid or has expired.");
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (sessionReady && existingToken && user) {
      navigate("/", { replace: true });
    }
  }, [sessionReady, existingToken, user, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const parsed = acceptInviteSchema.safeParse({ token, password });
    if (!parsed.success) {
      setError("Use a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post<{ token: string; user: AuthUser }>("/api/auth/accept-invite", parsed.data);
      if (!data?.token || !data?.user) {
        setError("Unexpected response. Try again.");
        return;
      }
      setToken(data.token);
      setUser(data.user);
      navigate("/", { replace: true });
    } catch (err) {
      if (isAxiosError(err)) {
        const d = err.response?.data as { error?: unknown } | undefined;
        if (typeof d?.error === "string") setError(d.error);
        else setError("Could not set password.");
      } else {
        setError("Could not set password.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (sessionReady && existingToken && user) {
    return <Navigate to="/" replace />;
  }

  if (!token.trim()) {
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <h1 className={styles.title}>Invitation unavailable</h1>
          <p className={styles.sub}>
            This link is missing an invitation token. Ask your coordinator for a new invite.
          </p>
          <Link className={styles.backToPortal} to="/login">
            ← Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (previewError) {
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <h1 className={styles.title}>Invitation unavailable</h1>
          <p className={styles.sub}>{previewError}</p>
          <Link className={styles.backToPortal} to="/login">
            ← Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (previewLoading || !preview) {
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <p className={styles.sub}>Checking your invitation…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <Link className={styles.backToPortal} to="/login">
          ← Sign in
        </Link>
        <h1 className={styles.title}>Choose your password</h1>
        <p className={styles.sub}>
          Welcome{preview.name ? `, ${preview.name}` : ""}. Set a password for <strong>{preview.email}</strong>.
        </p>

        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.label}>
            New password
            <input
              className={styles.input}
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              required
              disabled={busy}
            />
          </label>
          <label className={styles.label}>
            Confirm password
            <input
              className={styles.input}
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirm}
              onChange={(ev) => setConfirm(ev.target.value)}
              required
              disabled={busy}
            />
          </label>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button className={styles.submit} type="submit" disabled={busy}>
            {busy ? "Saving…" : "Activate account"}
          </button>
        </form>
      </div>
    </div>
  );
}
