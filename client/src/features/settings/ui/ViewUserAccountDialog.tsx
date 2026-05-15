import { useEffect, useId, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "@/services/api/http-client";
import inviteStyles from "./InviteUserDialog.module.css";
import styles from "./ViewUserAccountDialog.module.css";

export type ViewUserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  languages: string[];
  interpreterStatus: string | null;
  phone: string | null;
  profilePhoto?: string | null;
  createdAt: string;
  accountLocked: boolean;
};

function formatRole(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super admin";
    case "ADMIN":
      return "Coordinator";
    case "INTERPRETER":
      return "Interpreter";
    default:
      return role;
  }
}

function statusLabel(u: ViewUserRow): string {
  if (u.role !== "INTERPRETER") return "—";
  const st = u.interpreterStatus;
  if (st === "INACTIVE" || st === "VACATION" || st === "SICK_LEAVE") return "Pending / away";
  return "Active";
}

type ResetOk =
  | { kind: "email" }
  | { kind: "link"; resetLink: string };

export function ViewUserAccountDialog({
  user,
  open,
  onClose,
  onUserUpdated,
  allowActions,
  isSelf,
}: {
  user: ViewUserRow | null;
  open: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
  /** false for e.g. super admin row when current user is not super admin */
  allowActions: boolean;
  /** Viewing your own row — cannot lock your own account */
  isSelf: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [unlocking, setUnlocking] = useState(false);
  const [locking, setLocking] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [resetOk, setResetOk] = useState<ResetOk | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && user) {
      el.showModal();
      setError(null);
      setWarn(null);
      setResetOk(null);
      setCopyOk(false);
    } else {
      el.close();
    }
  }, [open, user]);

  const busy = unlocking || locking || resetting;

  function closeDialog() {
    if (!busy) {
      setResetOk(null);
      onClose();
    }
  }

  async function onUnlock() {
    if (!user) return;
    setUnlocking(true);
    setError(null);
    try {
      await api.post(`/users/${user.id}/unlock`);
      onUserUpdated();
      closeDialog();
    } catch (err) {
      setError(isAxiosError(err) ? String(err.response?.data?.error ?? err.message) : "Could not unlock.");
    } finally {
      setUnlocking(false);
    }
  }

  async function onLock() {
    if (!user) return;
    setLocking(true);
    setError(null);
    try {
      await api.post(`/users/${user.id}/lock`);
      onUserUpdated();
      closeDialog();
    } catch (err) {
      setError(isAxiosError(err) ? String(err.response?.data?.error ?? err.message) : "Could not lock.");
    } finally {
      setLocking(false);
    }
  }

  async function onResetPassword() {
    if (!user) return;
    setResetting(true);
    setError(null);
    setWarn(null);
    try {
      const { data } = await api.post<{ emailSent: boolean; resetLink?: string }>(
        `/users/${user.id}/password-reset`,
      );
      if (data.emailSent) {
        setResetOk({ kind: "email" });
      } else if (data.resetLink) {
        setResetOk({ kind: "link", resetLink: data.resetLink });
      } else {
        setError("No reset link returned.");
      }
      onUserUpdated();
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 500) {
        const d = err.response?.data as { error?: string; resetLink?: string } | undefined;
        if (typeof d?.resetLink === "string") {
          setResetOk({ kind: "link", resetLink: d.resetLink });
          setWarn(typeof d.error === "string" ? d.error : null);
          onUserUpdated();
          return;
        }
      }
      setError(isAxiosError(err) ? String(err.response?.data?.error ?? err.message) : "Could not send reset.");
    } finally {
      setResetting(false);
    }
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
    } catch {
      setError("Could not copy — select the link manually.");
    }
  }

  if (!user) return null;

  return (
    <dialog
      ref={dialogRef}
      className={inviteStyles.dialog}
      aria-labelledby={titleId}
      onClose={closeDialog}
      onCancel={(ev) => {
        ev.preventDefault();
        closeDialog();
      }}
    >
      <div className={inviteStyles.inner}>
        {resetOk ? (
          <div className={inviteStyles.done}>
            <h2 id={titleId} className={inviteStyles.title}>
              Password reset
            </h2>
            {resetOk.kind === "email" ? (
              <p className={inviteStyles.sub}>
                We sent an email to <strong>{user.email}</strong> with a link to set a new password.
              </p>
            ) : (
              <>
                <p className={inviteStyles.sub}>
                  Email is not configured on this server. Share this one-time link with <strong>{user.email}</strong>:
                </p>
                <div className={inviteStyles.linkBox}>
                  <code className={inviteStyles.linkCode}>{resetOk.resetLink}</code>
                </div>
                <button type="button" className={inviteStyles.copyBtn} onClick={() => copyLink(resetOk.resetLink)}>
                  {copyOk ? "Copied" : "Copy link"}
                </button>
              </>
            )}
            {warn ? <p className={styles.warn}>{warn}</p> : null}
            <button type="button" className={inviteStyles.doneBtn} onClick={closeDialog}>
              Done
            </button>
          </div>
        ) : (
          <>
            <header className={inviteStyles.head}>
              <h2 id={titleId} className={inviteStyles.title}>
                Account
              </h2>
              <p className={inviteStyles.sub}>View details and account actions for {user.name}.</p>
            </header>

            <div className={styles.grid}>
              <span className={styles.label}>Name</span>
              <span className={styles.value}>{user.name}</span>
              <span className={styles.label}>Email</span>
              <span className={styles.value}>{user.email}</span>
              <span className={styles.label}>Role</span>
              <span className={styles.value}>{formatRole(user.role)}</span>
              <span className={styles.label}>Linguist status</span>
              <span className={styles.value}>{statusLabel(user)}</span>
              <span className={styles.label}>Locked</span>
              <span className={styles.value}>{user.accountLocked ? "Yes" : "No"}</span>
              <span className={styles.label}>Phone</span>
              <span className={styles.value}>{user.phone || "—"}</span>
              <span className={styles.label}>Languages</span>
              <span className={styles.value}>
                {user.languages.length > 0 ? user.languages.join(", ") : "—"}
              </span>
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}

            {allowActions ? (
              <div className={styles.actions}>
                <div className={styles.actionRow}>
                  {user.accountLocked ? (
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => void onUnlock()}
                      disabled={busy}
                    >
                      {unlocking ? "Unlocking…" : "Unlock account"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnCaution}`}
                      onClick={() => void onLock()}
                      disabled={busy || isSelf}
                      title={isSelf ? "You cannot lock your own account" : undefined}
                    >
                      {locking ? "Locking…" : "Lock account"}
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => void onResetPassword()}
                    disabled={busy}
                  >
                    {resetting ? "Sending…" : "Send password reset"}
                  </button>
                </div>
              </div>
            ) : (
              <p className={`${inviteStyles.hint} ${styles.restrictedHint}`}>
                You can view this profile. Account actions are restricted for this user.
              </p>
            )}

            <div className={inviteStyles.actions}>
              <button type="button" className={inviteStyles.cancel} onClick={closeDialog} disabled={busy}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
