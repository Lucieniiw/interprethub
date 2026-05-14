import { Navigate, Link } from "react-router";
import { useAuth } from "@/features/auth/model/auth-context";
import { SessionSpinner } from "@/router/SessionSpinner";
import styles from "./LoginPortalPage.module.css";

export function LoginPortalPage() {
  const { token, sessionReady, user } = useAuth();

  if (!sessionReady) {
    return <SessionSpinner />;
  }

  // Only send home when we have both token and user; token alone caused loops when /me failed.
  if (token && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.intro}>
        <img
          src="/iiw-logo.png"
          alt=""
          className={styles.heroLogo}
        />
        <h1 className={styles.title}>
          <span className={styles.titleLine}>International Institute of</span>
          <span className={styles.titleWisconsin}>Wisconsin</span>
        </h1>
        <p className={styles.lead}>
          Choose linguist workspace or coordinator tools — scheduling and assignments for your team.
        </p>
      </header>
      <div className={styles.grid}>
        <Link to="/login/linguist" className={`${styles.choice} ${styles.choiceLinguist}`}>
          <span className={styles.choiceLabel}>Linguist portal</span>
          <span className={styles.choiceDesc}>Assignments, availability, earnings, and profile</span>
          <span className={styles.choiceAction}>Sign in →</span>
        </Link>
        <Link to="/login/coordinator" className={`${styles.choice} ${styles.choiceCoordinator}`}>
          <span className={styles.choiceLabel}>Coordinator &amp; admin</span>
          <span className={styles.choiceDesc}>Clients, jobs, team, activity, and settings</span>
          <span className={styles.choiceAction}>Sign in →</span>
        </Link>
      </div>
    </div>
  );
}
