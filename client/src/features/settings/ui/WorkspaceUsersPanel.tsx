import { useCallback, useEffect, useState } from "react";
import { Oval } from "react-loader-spinner";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import { api } from "@/services/api/http-client";
import { useAuth } from "@/features/auth/model/auth-context";
import { InviteUserDialog } from "./InviteUserDialog";
import { ViewUserAccountDialog, type ViewUserRow } from "./ViewUserAccountDialog";
import { EditUserDialog } from "./EditUserDialog";
import { DeleteUserConfirmDialog } from "./DeleteUserConfirmDialog";
import styles from "./WorkspaceUsersPanel.module.css";

type UserRow = ViewUserRow;

function canManageTarget(
  actorRole: string | undefined,
  target: Pick<UserRow, "role">,
): boolean {
  if (!actorRole) return false;
  if (target.role === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN") return false;
  return true;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

function formatRoleBadge(role: string): string {
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

function roleBadgeClass(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return styles.roleSuper;
    case "ADMIN":
      return styles.roleAdmin;
    default:
      return styles.roleInterp;
  }
}

function rowStatus(u: UserRow): "active" | "pending" {
  const st = u.interpreterStatus;
  if (st === "INACTIVE" || st === "VACATION" || st === "SICK_LEAVE") return "pending";
  return "active";
}

function formatLastActive(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return "—";
  }
}

function IconEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" strokeWidth="2" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16v12H4V6Zm0 0 8 6 8-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WorkspaceUsersPanel() {
  const { user } = useAuth();
  const canInviteSuperAdmin = user?.role === "SUPER_ADMIN";

  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  const [viewUser, setViewUser] = useState<UserRow | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [resendFlash, setResendFlash] = useState<string | null>(null);
  const [resendLink, setResendLink] = useState<{ email: string; link: string } | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get<UserRow[]>("/users");
      setRows(r.data);
    } catch {
      setError("Could not load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUsers = useCallback(async () => {
    try {
      const r = await api.get<UserRow[]>("/users");
      setRows(r.data);
      setError(null);
    } catch {
      setError("Could not refresh users.");
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function onResendInvite(u: UserRow) {
    setResendFlash(null);
    setResendLink(null);
    try {
      const { data } = await api.post<{ emailSent: boolean; resetLink?: string }>(
        `/users/${u.id}/password-reset`,
      );
      if (data.emailSent) {
        setResendFlash(`Password reset email sent to ${u.email}.`);
      } else if (data.resetLink) {
        setResendLink({ email: u.email, link: data.resetLink });
        setResendFlash(
          "Email is not configured. Copy the link below and send it to the user.",
        );
      }
      void refreshUsers();
    } catch {
      setResendFlash("Could not send password reset.");
    }
  }

  async function copyResendLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setResendFlash("Link copied to clipboard.");
    } catch {
      setResendFlash("Could not copy — select the link manually.");
    }
  }

  if (loading) {
    return (
      <div className={styles.loader}>
        <Oval height={42} width={42} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
      </div>
    );
  }

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  return (
    <div className={styles.um}>
      <header className={styles.umHeader}>
        <h2 className={styles.umTitle}>User Management</h2>
        <button type="button" className={styles.inviteBtn} onClick={() => setInviteOpen(true)}>
          <span className={styles.inviteIcon} aria-hidden>
            +
          </span>
          Invite User
        </button>
      </header>

      {resendFlash || resendLink ? (
        <div className={styles.flash} role="status">
          {resendFlash ? <p className={styles.flashText}>{resendFlash}</p> : null}
          {resendLink ? (
            <div className={styles.flashLinkRow}>
              <code className={styles.flashCode}>{resendLink.link}</code>
              <button type="button" className={styles.flashCopy} onClick={() => copyResendLink(resendLink.link)}>
                Copy link
              </button>
            </div>
          ) : null}
          <button type="button" className={styles.flashDismiss} onClick={() => { setResendFlash(null); setResendLink(null); }}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">User</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Locked</th>
              <th scope="col">Last active</th>
              <th scope="col" className={styles.thActions}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const status = rowStatus(u);
              const pending = status === "pending";
              const manage = canManageTarget(user?.role, u);
              const isSelf = user?.id === u.id;
              return (
                <tr key={u.id}>
                  <td>
                    <div className={styles.userCell}>
                      <span className={styles.avatar} aria-hidden>
                        {initials(u.name)}
                      </span>
                      <div className={styles.userText}>
                        <span className={styles.userName}>{u.name}</span>
                        <span className={styles.userEmail}>{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles.roleBadge} ${roleBadgeClass(u.role)}`}>
                      {formatRoleBadge(u.role)}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        pending
                          ? `${styles.badge} ${styles.badgeStatus} ${styles.badgePending}`
                          : `${styles.badge} ${styles.badgeStatus} ${styles.badgeActive}`
                      }
                    >
                      {pending ? "Pending" : "Active"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${styles.badgeLock} ${u.accountLocked ? styles.badgeLockYes : ""}`}
                    >
                      {u.accountLocked ? "Yes" : "No"}
                    </span>
                  </td>
                  <td>
                    <span className={styles.lastActive}>{formatLastActive(u.createdAt)}</span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title="View account"
                        aria-label="View account"
                        onClick={() => {
                          setViewUser(u);
                          setViewOpen(true);
                        }}
                      >
                        <IconEye />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title={manage ? "Edit user" : "You cannot edit this account"}
                        aria-label="Edit user"
                        disabled={!manage}
                        onClick={() => {
                          setEditUser(u);
                          setEditOpen(true);
                        }}
                      >
                        <IconPencil />
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        title={isSelf ? "You cannot delete your own account" : "Delete user"}
                        aria-label="Delete user"
                        disabled={isSelf || !manage}
                        onClick={() => {
                          setDeleteUser(u);
                          setDeleteOpen(true);
                        }}
                      >
                        <IconTrash />
                      </button>
                      {pending ? (
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title="Resend password reset"
                          aria-label="Resend password reset"
                          disabled={!manage}
                          onClick={() => void onResendInvite(u)}
                        >
                          <IconMail />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className={styles.hint}>
        “Last active” shows account created time until session activity is tracked. The envelope sends a password reset
        (same as invite) for linguists marked inactive, on leave, or away.
      </p>

      <InviteUserDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onCreated={refreshUsers}
        canInviteSuperAdmin={canInviteSuperAdmin}
      />

      <ViewUserAccountDialog
        user={viewOpen ? viewUser : null}
        open={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setViewUser(null);
        }}
        onUserUpdated={refreshUsers}
        allowActions={viewUser ? canManageTarget(user?.role, viewUser) : false}
        isSelf={Boolean(viewUser && user?.id === viewUser.id)}
      />

      <EditUserDialog
        user={editOpen ? editUser : null}
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditUser(null);
        }}
        onSaved={refreshUsers}
        canInviteSuperAdmin={canInviteSuperAdmin}
      />

      <DeleteUserConfirmDialog
        user={
          deleteOpen && deleteUser
            ? { id: deleteUser.id, name: deleteUser.name, email: deleteUser.email }
            : null
        }
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteUser(null);
        }}
        onDeleted={refreshUsers}
      />
    </div>
  );
}
