import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { useAuth } from "@/features/auth/model/auth-context";
import { resolveUploadUrl } from "@/utils/resolve-upload-url";
import styles from "./UserMenuBar.module.css";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

function roleLabel(role: string) {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super admin";
    case "ADMIN":
      return "Coordinator";
    case "INTERPRETER":
      return "Linguist";
    default:
      return role;
  }
}

type Props = {
  /** Narrow screens: show avatar only (paired with bottom tabs for linguists). */
  hideMetaOnMobile?: boolean;
};

export function UserMenuBar({ hideMetaOnMobile }: Props) {
  const { user } = useAuth();
  const [imgBroken, setImgBroken] = useState(false);

  useEffect(() => {
    setImgBroken(false);
  }, [user?.profilePhoto]);

  if (!user) return null;

  const photo = resolveUploadUrl(user.profilePhoto);

  return (
    <NavLink
      to="/settings"
      className={({ isActive }) =>
        `${styles.wrap}${hideMetaOnMobile ? ` ${styles.wrapHideMetaMobile}` : ""}${isActive ? ` ${styles.wrapActive}` : ""}`
      }
      title="Account settings"
    >
      <span className={styles.avatar} aria-hidden>
        {photo && !imgBroken ? (
          <img
            src={photo}
            alt=""
            className={styles.avatarImg}
            onError={() => setImgBroken(true)}
          />
        ) : (
          <span className={styles.initials}>{initials(user.name)}</span>
        )}
      </span>
      <span className={styles.meta}>
        <span className={styles.name}>{user.name}</span>
        <span className={styles.role}>{roleLabel(user.role)}</span>
      </span>
    </NavLink>
  );
}
