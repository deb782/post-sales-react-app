import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const OnboardCtx = createContext({ status: null, loading: true, refresh: () => {} });

export function OnboardingProvider({ children }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setStatus(null); setLoading(false); return; }
    try {
      const { data } = await api.get("/onboarding/status");
      setStatus(data);
    } catch (_e) { /* ignore */ }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);

  return <OnboardCtx.Provider value={{ status, loading, refresh }}>{children}</OnboardCtx.Provider>;
}

export const useOnboarding = () => useContext(OnboardCtx);
