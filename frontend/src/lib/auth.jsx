import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data?.access_token) localStorage.setItem("access_token", data.access_token);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (_e) { /* ignore */ }
    localStorage.removeItem("access_token");
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, refresh, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

export const ROLE_LABELS = {
  admin: "Admin",
  accounts: "Accounts",
  management: "Management",
  site_manager: "Site Manager",
};

export const can = (user, ...roles) => user && roles.includes(user.role);
