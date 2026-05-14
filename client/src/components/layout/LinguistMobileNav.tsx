import { NavLink, useLocation } from "react-router";
import styles from "./LinguistMobileNav.module.css";

function IconBriefcase() {
  return (
    <svg className={styles.icon} width={26} height={26} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 12v3" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg className={styles.icon} width={26} height={26} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.85" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg className={styles.icon} width={26} height={26} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 4h6l1 2h3a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3l1-2Z"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
    </svg>
  );
}

function IconEarnings() {
  return (
    <svg className={styles.icon} width={26} height={26} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v18M17 7.5H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H7"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconAccount() {
  return (
    <svg className={styles.icon} width={26} height={26} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.85" />
      <path
        d="M5 19.5c1.6-3 4.5-4.5 7-4.5s5.4 1.5 7 4.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </svg>
  );
}

function assignmentsTabActive(pathname: string): boolean {
  if (pathname.startsWith("/assignments")) return true;
  return pathname.startsWith("/jobs/") && pathname !== "/jobs/new";
}

function accountTabActive(pathname: string): boolean {
  return pathname.startsWith("/settings") || pathname.startsWith("/profile");
}

export function LinguistMobileNav() {
  const { pathname } = useLocation();

  const items = [
    {
      to: "/open-jobs",
      end: true as const,
      label: "Jobs",
      Icon: IconBriefcase,
      active: pathname === "/open-jobs",
    },
    {
      to: "/schedule",
      end: true as const,
      label: "Schedule",
      Icon: IconCalendar,
      active: pathname === "/schedule",
    },
    {
      to: "/assignments",
      end: false as const,
      label: "Assignments",
      Icon: IconClipboard,
      active: assignmentsTabActive(pathname),
    },
    {
      to: "/earnings",
      end: true as const,
      label: "Earnings",
      Icon: IconEarnings,
      active: pathname === "/earnings",
    },
    {
      to: "/settings",
      end: false as const,
      label: "Account",
      Icon: IconAccount,
      active: accountTabActive(pathname),
    },
  ];

  return (
    <nav className={styles.bar} aria-label="Primary navigation">
      {items.map(({ to, end, label, Icon, active }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={`${styles.tab}${active ? ` ${styles.tabActive}` : ""}`}
          aria-current={active ? "page" : undefined}
        >
          <Icon />
          <span className={styles.label}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
