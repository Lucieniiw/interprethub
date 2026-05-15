import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isAxiosError } from "axios";
import { api } from "@/services/api/http-client";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "INTERPRETER";
  languages: string[];
  profilePhoto: string | null;
  residentialCounty: string | null;
};

type AuthContextValue = {
  token: string | null;
  setToken: (token: string | null) => void;
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  refreshUser: () => Promise<void>;
  /** True once initial / missing token or first `/auth/me` after token has finished */
  sessionReady: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("token") : null,
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionReady, setSessionReady] = useState(
    () => typeof window === "undefined" || !localStorage.getItem("token"),
  );

  const refreshUser = useCallback(async () => {
    const t =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!t) {
      setUser(null);
      return;
    }
    try {
      const { data } = await api.get<AuthUser>("/auth/me");
      setUser(data);
    } catch (e) {
      setUser(null);
      // Any failure means the session is not usable (wrong proxy/port, expired token, network, etc.).
      // Keeping the token causes / ↔ /login redirect loops because routes disagree on “logged in”.
      setTokenState(null);
      if (typeof window !== "undefined") localStorage.removeItem("token");
      if (import.meta.env.DEV && isAxiosError(e) && !e.response) {
        console.warn(
          "[auth] /api/auth/me failed before a response (check API is running and VITE_API_PROXY_TARGET / dev proxy port).",
          e.message,
        );
      }
    }
  }, []);

  const setToken = useCallback((value: string | null) => {
    setTokenState(value);
    if (typeof window === "undefined") return;
    if (value) localStorage.setItem("token", value);
    else {
      localStorage.removeItem("token");
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setSessionReady(true);
      return;
    }
    setSessionReady(false);
    void refreshUser().finally(() => setSessionReady(true));
  }, [token, refreshUser]);

  const value = useMemo(
    () => ({ token, setToken, user, setUser, refreshUser, sessionReady }),
    [token, setToken, user, refreshUser, sessionReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
