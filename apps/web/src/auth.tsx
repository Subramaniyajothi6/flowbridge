import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { api } from "./api.ts";
import { setDisplayTimezone } from "./format.ts";
import { NoAccessPage } from "./pages/NoAccessPage.tsx";
import type { AuthStatus, Role, Session } from "./types.ts";

export const ROLE_LABELS: Record<Role, string> = {
  administrator: "Administrator",
  workflow_creator: "Workflow Creator",
  business_user: "Business User",
  technical_operator: "Technical Operator",
};

type AuthContextValue = {
  status: AuthStatus | null;
  session: Session | null;
  // Only decides what to show. The server checks every request for itself.
  can: (permission: string) => boolean;
  acceptSession: (session: Session) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null);

  const refresh = useCallback(async () => {
    const loaded = await api.authStatus();
    if (loaded.session) setDisplayTimezone(loaded.session.user.timezone);
    setStatus(loaded);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const session = status?.session ?? null;

  const value: AuthContextValue = {
    status,
    session,
    can: (permission) => session?.permissions.includes(permission) ?? false,
    acceptSession: (next) => {
      setDisplayTimezone(next.user.timezone);
      setStatus({ workspaceExists: true, session: next });
    },
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext) as AuthContextValue;
}

// Wraps a page that needs someone signed in, and optionally a permission.
export function Protected({ permission, children }: { permission?: string; children: ReactNode }) {
  const { status, session, can } = useAuth();

  if (!status) return null;
  if (!session) return <Navigate to={status.workspaceExists ? "/sign-in" : "/register"} replace />;
  if (permission && !can(permission)) return <NoAccessPage />;
  return <>{children}</>;
}
