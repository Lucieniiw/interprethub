import { LoginFormCard } from "./LoginFormCard";
import loginStyles from "./LoginPage.module.css";

export function CoordinatorLoginPage() {
  return (
    <LoginFormCard
      portal="coordinator"
      title="Coordinator & admin"
      subtitle="Sign in to manage clients, jobs, team, notifications, and settings."
      alternateSignIn={{
        label: "Linguist? Use the linguist portal sign-in",
        to: "/login/linguist",
      }}
    />
  );
}
