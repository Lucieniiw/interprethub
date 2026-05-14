import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { Oval } from "react-loader-spinner";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import { api } from "@/services/api/http-client";
import umStyles from "@/features/settings/ui/WorkspaceUsersPanel.module.css";
import { ViewLinguistDialog } from "./ViewLinguistDialog";
import styles from "./TeamPage.module.css";

type UserRow = {
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
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

export function TeamPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<UserRow[]>("/api/users")
      .then((r) => setRows(r.data.filter((u) => u.role === "INTERPRETER")))
      .catch(() => setError("Could not load linguists."))
      .finally(() => setLoading(false));
  }, []);

  if (loading && rows.length === 0 && !error) {
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
    <div className={`${umStyles.um} ${styles.page}`}>
      <header className={umStyles.umHeader}>
        <div>
          <h1 className={umStyles.umTitle}>Linguists</h1>
          <p className={styles.lead}>
            Interpreters in your workspace. Linguist pay rates are separate from client billing — open the row (eye) to view them,
            or edit the user in User Management to set pay amounts.
          </p>
        </div>
        <NavLink to="/settings?tab=users" className={umStyles.inviteBtn}>
          <span className={umStyles.inviteIcon} aria-hidden>
            +
          </span>
          Invite linguist
        </NavLink>
      </header>

      <div className={umStyles.tableWrap}>
        <table className={umStyles.table}>
          <thead>
            <tr>
              <th scope="col">User</th>
              <th scope="col">Languages</th>
              <th scope="col">Status</th>
              <th scope="col">Locked</th>
              <th scope="col">Joined</th>
              <th scope="col" className={umStyles.thActions}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  No interpreters yet. Use &quot;Invite linguist&quot; to add someone in User Management (choose Interpreter).
                </td>
              </tr>
            ) : (
              rows.map((u) => {
                const status = rowStatus(u);
                const pending = status === "pending";
                return (
                  <tr key={u.id}>
                    <td>
                      <div className={umStyles.userCell}>
                        <span className={umStyles.avatar} aria-hidden>
                          {initials(u.name)}
                        </span>
                        <div className={umStyles.userText}>
                          <span className={umStyles.userName}>{u.name}</span>
                          <span className={umStyles.userEmail}>{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={umStyles.lastActive}>
                        {u.languages?.length ? u.languages.join(", ") : "—"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          pending
                            ? `${umStyles.badge} ${umStyles.badgeStatus} ${umStyles.badgePending}`
                            : `${umStyles.badge} ${umStyles.badgeStatus} ${umStyles.badgeActive}`
                        }
                      >
                        {pending ? "Away / inactive" : "Active"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`${umStyles.badge} ${umStyles.badgeLock} ${u.accountLocked ? umStyles.badgeLockYes : ""}`}
                      >
                        {u.accountLocked ? "Yes" : "No"}
                      </span>
                    </td>
                    <td>
                      <span className={umStyles.lastActive}>{formatLastActive(u.createdAt)}</span>
                    </td>
                    <td>
                      <div className={umStyles.actions}>
                        <button
                          type="button"
                          className={umStyles.iconBtn}
                          title="View details (pay rates)"
                          aria-label="View linguist details"
                          onClick={() => setViewId(u.id)}
                        >
                          <IconEye />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ViewLinguistDialog linguistId={viewId} open={viewId != null} onClose={() => setViewId(null)} />
    </div>
  );
}
