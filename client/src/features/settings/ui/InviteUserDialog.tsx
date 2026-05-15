import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "@/services/api/http-client";
import styles from "./InviteUserDialog.module.css";

/** UI picks among four labels; Admin + Coordinator both map to API role ADMIN */
type UiRoleChoice = "super" | "admin" | "coord" | "interp";

function toApiRole(choice: UiRoleChoice): "SUPER_ADMIN" | "ADMIN" | "INTERPRETER" {
  if (choice === "interp") return "INTERPRETER";
  if (choice === "super") return "SUPER_ADMIN";
  return "ADMIN";
}

function apiErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const d = err.response?.data as { error?: string; inviteLink?: string } | undefined;
    if (typeof d?.error === "string") return d.error;
  }
  return "Could not send invitation.";
}

type InviteSuccess =
  | { kind: "email"; email: string }
  | { kind: "link"; email: string; inviteLink: string };

export function InviteUserDialog({
  open,
  onClose,
  onCreated,
  canInviteSuperAdmin,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  canInviteSuperAdmin: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [uiRole, setUiRole] = useState<UiRoleChoice>("coord");
  const [languages, setLanguages] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<InviteSuccess | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      el.showModal();
      setName("");
      setEmail("");
      setUiRole("coord");
      setLanguages("");
      setError(null);
      setSuccess(null);
      setCopyOk(false);
    } else {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    if (!canInviteSuperAdmin && uiRole === "super") setUiRole("coord");
  }, [canInviteSuperAdmin, uiRole]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCopyOk(false);
    const role = toApiRole(uiRole);
    if (role === "SUPER_ADMIN" && !canInviteSuperAdmin) {
      setError("You cannot assign super admin.");
      return;
    }
    const langs = languages
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      const { data } = await api.post<{
        emailSent: boolean;
        inviteLink?: string;
      }>("/auth/invite-user", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        languages: langs,
      });
      const em = email.trim().toLowerCase();
      if (data.emailSent) {
        setSuccess({ kind: "email", email: em });
      } else if (data.inviteLink) {
        setSuccess({ kind: "link", email: em, inviteLink: data.inviteLink });
      } else {
        setError("Invitation created but no email or link was returned.");
      }
      onCreated();
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 500) {
        const d = err.response?.data as { error?: string; inviteLink?: string } | undefined;
        const em = email.trim().toLowerCase();
        if (typeof d?.inviteLink === "string") {
          setSuccess({ kind: "link", email: em, inviteLink: d.inviteLink });
          setError(typeof d.error === "string" ? d.error : null);
          onCreated();
          return;
        }
      }
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
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

  function onDialogClose() {
    if (!saving) {
      setSuccess(null);
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onDialogClose}
      onCancel={(ev) => {
        ev.preventDefault();
        onDialogClose();
      }}
    >
      <div className={styles.inner}>
        {success ? (
          <div className={styles.done}>
            <h2 id={titleId} className={styles.title}>
              Invitation ready
            </h2>
            {success.kind === "email" ? (
              <p className={styles.sub}>
                We sent an email to <strong>{success.email}</strong> with a link to choose their password.
              </p>
            ) : (
              <>
                <p className={styles.sub}>
                  Email is not configured on this server. Share this one-time link with <strong>{success.email}</strong>{" "}
                  (they must open it to set their password):
                </p>
                <div className={styles.linkBox}>
                  <code className={styles.linkCode}>{success.inviteLink}</code>
                </div>
                <button type="button" className={styles.copyBtn} onClick={() => copyLink(success.inviteLink)}>
                  {copyOk ? "Copied" : "Copy link"}
                </button>
              </>
            )}
            {error ? <p className={styles.warn}>{error}</p> : null}
            <button type="button" className={styles.doneBtn} onClick={onDialogClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <header className={styles.head}>
              <h2 id={titleId} className={styles.title}>
                Invite new user
              </h2>
              <p className={styles.sub}>They will receive an email to choose their own password (unless email is not configured).</p>
            </header>

            <form className={styles.form} onSubmit={onSubmit}>
              <label className={styles.label}>
                Full name
                <input
                  className={styles.input}
                  value={name}
                  onChange={(ev) => setName(ev.target.value)}
                  required
                  autoComplete="name"
                  disabled={saving}
                />
              </label>
              <label className={styles.label}>
                Email
                <input
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  required
                  autoComplete="email"
                  disabled={saving}
                />
              </label>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Role</span>
                <div className={styles.roleGrid}>
                  {canInviteSuperAdmin ? (
                    <label className={styles.radio}>
                      <input
                        type="radio"
                        name="invite-role"
                        checked={uiRole === "super"}
                        onChange={() => setUiRole("super")}
                        disabled={saving}
                      />
                      Super admin
                    </label>
                  ) : null}
                  <label className={styles.radio}>
                    <input
                      type="radio"
                      name="invite-role"
                      checked={uiRole === "admin"}
                      onChange={() => setUiRole("admin")}
                      disabled={saving}
                    />
                    Admin
                  </label>
                  <label className={styles.radio}>
                    <input
                      type="radio"
                      name="invite-role"
                      checked={uiRole === "coord"}
                      onChange={() => setUiRole("coord")}
                      disabled={saving}
                    />
                    Coordinator
                  </label>
                  <label className={styles.radio}>
                    <input
                      type="radio"
                      name="invite-role"
                      checked={uiRole === "interp"}
                      onChange={() => setUiRole("interp")}
                      disabled={saving}
                    />
                    Interpreter
                  </label>
                </div>
                <p className={styles.hint}>Admin and Coordinator use the same coordinator-level access.</p>
              </div>

              <label className={styles.label}>
                Languages <span className={styles.optional}>(optional)</span>
                <input
                  className={styles.input}
                  value={languages}
                  onChange={(ev) => setLanguages(ev.target.value)}
                  placeholder="Spanish, French…"
                  disabled={saving}
                />
              </label>

              {error ? <p className={styles.error}>{error}</p> : null}

              <div className={styles.actions}>
                <button type="button" className={styles.cancel} onClick={onDialogClose} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className={styles.submit} disabled={saving}>
                  {saving ? "Sending…" : "Send invitation"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </dialog>
  );
}
