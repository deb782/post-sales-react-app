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
  super_admin: "Super Admin",
  process_admin: "Process Admin",
  crm_head: "CRM Head",
  sales_head: "Sales Head",
  accounts_head: "Accounts Head",
  sales_rep: "Sales Representative",
  post_sales_rep: "Post-Sales Representative",
  accounts_rep: "Accounts Representative",
  site_supervisor: "Site Supervisor",
};

export const ROLE_ORDER = [
  "super_admin", "process_admin",
  "crm_head", "sales_head", "accounts_head",
  "sales_rep", "post_sales_rep", "accounts_rep",
  "site_supervisor",
];

export const ADMIN_TIER = ["super_admin", "process_admin"];
export const HEADS = ["super_admin", "process_admin", "crm_head", "sales_head", "accounts_head"];

export const can = (user, ...roles) => user && roles.includes(user.role);

/** Users allowed to run setup (subject to Super Admin approval). */
export const canSetup = (user) => can(user, "super_admin", "process_admin");

/** Only Super Admin can give final approvals. */
export const canApproveFinal = (user) => can(user, "super_admin");
