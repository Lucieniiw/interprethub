import { useEffect, useId, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "@/services/api/http-client";
import inviteStyles from "./InviteUserDialog.module.css";

export type DeleteUserRow = { id: number; name: string; email: string };

export function DeleteUserConfirmDialog({
  user,
  open,
  onClose,
  onDeleted,
}: {
  user: DeleteUserRow | null;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && user) {
      el.showModal();
      setError(null);
    } else {
      el.close();
    }
  }, [open, user]);

  function closeDialog() {
    if (!busy) onClose();
  }

  async function confirmDelete() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/users/${user.id}`);
      onDeleted();
      closeDialog();
    } catch (err) {
      setError(isAxiosError(err) ? String(err.response?.data?.error ?? err.message) : "Could not delete.");
    } finally {
      setBusy(false);
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
        <header className={inviteStyles.head}>
          <h2 id={titleId} className={inviteStyles.title}>
            Delete account
          </h2>
          <p className={inviteStyles.sub}>
            Permanently remove <strong>{user.name}</strong> ({user.email}) from this workspace? This cannot be undone.
          </p>
        </header>
        {error ? <p className={inviteStyles.error}>{error}</p> : null}
        <div className={inviteStyles.actions}>
          <button type="button" className={inviteStyles.cancel} onClick={closeDialog} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={inviteStyles.submitDanger}
            onClick={() => void confirmDelete()}
            disabled={busy}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
