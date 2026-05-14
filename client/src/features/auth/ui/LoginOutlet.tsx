import { Outlet } from "react-router";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import styles from "./LoginOutlet.module.css";

export function LoginOutlet() {
  return (
    <div className={styles.loginShell}>
      <div className={styles.themeBar} aria-label="Display settings">
        <ThemeToggle />
      </div>
      <Outlet />
    </div>
  );
}
