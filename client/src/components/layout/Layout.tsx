import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LinguistMobileNav } from "@/components/layout/LinguistMobileNav";
import { UserMenuBar } from "@/components/layout/UserMenuBar";
import { useAuth } from "@/features/auth/model/auth-context";
import styles from "./layout.module.css";

const SIDEBAR_COLLAPSED_KEY = "iiw-sidebar-collapsed";

function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function greetingForLocalHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(fullName: string): string {
  const t = fullName.trim();
  if (!t) return "there";
  return t.split(/\s+/)[0] ?? t;
}

export function Layout() {
  const { setToken, user } = useAuth();
  const isStaff = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const isLinguist = user?.role === "INTERPRETER";

  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);

  const greetingLine = user
    ? `${greetingForLocalHour(new Date().getHours())}, ${firstName(user.name)}`
    : null;

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  return (
    <div
      className={`${styles.shell}${isLinguist ? ` ${styles.shellLinguist}` : ""}`}
      data-collapsed={sidebarCollapsed ? "true" : "false"}
    >
      <aside className={styles.sidebar} aria-hidden={sidebarCollapsed}>
        <div className={styles.brand}>
          <img
            src="/iiw-logo.png"
            alt="International Institute of Wisconsin"
            className={styles.brandLogo}
          />
          {isLinguist ? <span className={styles.brandTagline}>Linguist portal</span> : null}
        </div>
        <nav className={styles.nav}>
          {isLinguist ? (
            <>
              <NavLink
                to="/open-jobs"
                className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
              >
                Open jobs
              </NavLink>
              <NavLink
                to="/schedule"
                className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
              >
                My schedule
              </NavLink>
              <NavLink
                to="/availability"
                className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
              >
                Availability
              </NavLink>
              <NavLink
                to="/earnings"
                className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
              >
                Earnings
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
              >
                Settings
              </NavLink>
            </>
          ) : isStaff ? (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/assignments"
                className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
              >
                Assignments
              </NavLink>
              <NavLink
                to="/linguists"
                className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
              >
                Linguist
              </NavLink>
              <NavLink
                to="/clients"
                className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
              >
                Clients
              </NavLink>
              <NavLink
                to="/reports"
                className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
              >
                Reports
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
              >
                Settings
              </NavLink>
            </>
          ) : null}
        </nav>
        <button type="button" className={styles.signOut} onClick={() => setToken(null)}>
          Sign out
        </button>
      </aside>
      <main className={styles.main}>
        <div className={styles.topBar}>
          <button
            type="button"
            className={styles.sidebarToggle}
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M15 6 9 12l6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          {user ? (
            <div className={styles.topBarBrand}>
              <img
                src="/iiw-logo.png"
                alt=""
                className={styles.topBarLogo}
                width={120}
                height={36}
              />
              <div className={styles.topBarTitles}>
                <span className={styles.orgName}>International Institute of Wisconsin</span>
                <span className={styles.greeting}>{greetingLine}</span>
              </div>
            </div>
          ) : null}
          <div className={styles.topBarRight}>
            <ThemeToggle />
            <NotificationBell />
            <UserMenuBar hideMetaOnMobile={isLinguist} />
          </div>
        </div>
        <div className={styles.mainScroll}>
          <Outlet />
        </div>
      </main>
      {isLinguist ? <LinguistMobileNav /> : null}
    </div>
  );
}
