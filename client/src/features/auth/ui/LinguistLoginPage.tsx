import { LoginFormCard } from "./LoginFormCard";
import loginStyles from "./LoginPage.module.css";

export function LinguistLoginPage() {
  return (
    <LoginFormCard
      portal="linguist"
      title="Linguist portal"
      subtitle="Sign in to manage assignments, availability, earnings, and your profile."
      wrapExtraClass={loginStyles.wrapLinguist}
      cardExtraClass={loginStyles.cardLinguist}
      alternateSignIn={{
        label: "Coordinator or admin? Use the coordinator sign-in",
        to: "/login/coordinator",
      }}
    />
  );
}
