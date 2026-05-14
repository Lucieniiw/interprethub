import { RequireRole } from "@/router/RequireRole";
import { useAuth } from "@/features/auth/model/auth-context";
import { LinguistSettingsPage } from "./LinguistSettingsPage";
import { SettingsPage } from "./SettingsPage";

export function SettingsRoute() {
  const { user } = useAuth();
  if (user?.role === "INTERPRETER") {
    return <LinguistSettingsPage />;
  }
  return (
    <RequireRole roles={["ADMIN", "SUPER_ADMIN"]}>
      <SettingsPage />
    </RequireRole>
  );
}
