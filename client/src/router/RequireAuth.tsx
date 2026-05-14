import { Navigate, useLocation } from "react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/features/auth/model/auth-context";
import { SessionSpinner } from "@/router/SessionSpinner";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { token, sessionReady } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Don’t render the app shell until /api/auth/me has settled — avoids login ↔ dashboard races.
  if (!sessionReady) {
    return <SessionSpinner />;
  }

  return children;
}
