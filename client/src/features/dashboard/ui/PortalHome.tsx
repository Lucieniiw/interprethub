import { Navigate } from "react-router";
import { Oval } from "react-loader-spinner";
import { useAuth } from "@/features/auth/model/auth-context";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import styles from "./PortalHome.module.css";

export function PortalHome() {
  const { user, sessionReady } = useAuth();

  if (!sessionReady) {
    return (
      <div className={styles.loader}>
        <Oval height={42} width={42} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
      </div>
    );
  }

  // Should not happen once RequireAuth waits for sessionReady and failed /me clears the token.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "INTERPRETER") {
    return <Navigate to="/open-jobs" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}
