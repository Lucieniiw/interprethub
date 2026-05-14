import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "@/features/auth/model/auth-context";
import { SessionSpinner } from "./SessionSpinner";

export function RequireInterpreter({ children }: { children: ReactNode }) {
  const { user, sessionReady } = useAuth();
  if (!sessionReady) {
    return <SessionSpinner />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== "INTERPRETER") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
