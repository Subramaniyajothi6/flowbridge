import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api.ts";
import { useAuth } from "./auth.tsx";

// Logos an Administrator chose, by app. Shared by every screen, so a new logo
// shows everywhere at once, including the builder.
type LogosValue = { addresses: Record<string, string>; refresh: () => Promise<void> };

const LogosContext = createContext<LogosValue>({ addresses: {}, refresh: async () => {} });

export function LogosProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [addresses, setAddresses] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setAddresses(await api.listLogos());
  }, []);

  useEffect(() => {
    if (session) void refresh().catch(() => {});
  }, [session, refresh]);

  return <LogosContext.Provider value={{ addresses, refresh }}>{children}</LogosContext.Provider>;
}

export function useLogos(): LogosValue {
  return useContext(LogosContext);
}
