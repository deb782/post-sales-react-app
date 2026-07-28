import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { API_BASE } from "@/lib/api";

const BrandCtx = createContext({ company_name: "Estate OS", logo_url: null, refresh: () => {} });

export function BrandingProvider({ children }) {
  const [brand, setBrand] = useState({ company_name: "Estate OS", logo_url: null });

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/settings/public`, { credentials: "include" });
      if (!r.ok) return;
      const data = await r.json();
      setBrand({
        company_name: data.company_name || "Estate OS",
        currency: data.currency || "INR",
        logo_url: data.logo_file_id ? `${API_BASE}/files/${data.logo_file_id}/download` : null,
      });
    } catch (_e) { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <BrandCtx.Provider value={{ ...brand, refresh: load }}>
      {children}
    </BrandCtx.Provider>
  );
}

export const useBranding = () => useContext(BrandCtx);
