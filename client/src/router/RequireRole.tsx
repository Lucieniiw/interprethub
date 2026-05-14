import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { type AuthUser, useAuth } from "@/features/auth/model/auth-context";
import { SessionSpinner } from "./SessionSpinner";

type Props = {
  roles: AuthUser["role"][];
  children: ReactNode;
};

export function RequireRole({ roles, children }: Props) {
  const { user, sessionReady } = useAuth();
  if (!sessionReady) {
    return <SessionSpinner />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
