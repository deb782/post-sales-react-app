import { useEffect, useRef, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, Image as ImageIcon, Trash2 } from "lucide-react";
import { useBranding } from "@/lib/branding";

export default function Settings() {
  const [s, setS] = useState({ approval_threshold: 50000, currency: "INR", company_name: "Estate OS", logo_file_id: null });
  const fileRef = useRef();
  const { refresh: refreshBrand } = useBranding();

  const load = async () => {
    const { data } = await api.get("/settings");
    setS(data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.patch("/settings", {
        approval_threshold: Number(s.approval_threshold) || 0,
        currency: s.currency,
        company_name: s.company_name,
      });
      toast.success("Settings saved");
      await load(); refreshBrand();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const uploadLogo = async (f) => {
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    try {
      await api.post("/files/logo", fd);
      toast.success("Logo updated");
      await load(); refreshBrand();
    } catch (e) { toast.error(e?.response?.data?.detail || "Upload failed"); }
  };

  const clearLogo = async () => {
    try {
      await api.patch("/settings", { logo_file_id: "" });
      toast.success("Logo removed");
      await load(); refreshBrand();
    } catch (e) { toast.error("Failed"); }
  };

  const logoUrl = s.logo_file_id ? `${API_BASE}/files/${s.logo_file_id}/download?ts=${Date.now()}` : null;

  return (
    <div className="space-y-6" data-testid="settings-root">
      <div>
        <div className="text-xs uppercase tracking-widest text-stone-500">System</div>
        <h1 className="text-4xl font-bold text-stone-900 mt-1">Settings</h1>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-6 max-w-2xl space-y-6">
        <div>
          <div className="text-sm font-semibold text-stone-800 mb-3">Branding</div>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg border border-stone-200 bg-stone-50 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="w-full h-full object-contain" data-testid="settings-logo-preview" />
              ) : (
                <ImageIcon className="w-8 h-8 text-stone-300" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={(e) => uploadLogo(e.target.files?.[0])} data-testid="logo-file-input" />
              <Button variant="outline" onClick={() => fileRef.current?.click()} data-testid="upload-logo-btn"><Upload className="w-4 h-4 mr-1" /> Upload logo</Button>
              {s.logo_file_id && (
                <Button variant="outline" onClick={clearLogo} className="text-rose-700"><Trash2 className="w-4 h-4 mr-1" /> Remove</Button>
              )}
            </div>
          </div>
          <div className="text-xs text-stone-500 mt-2">PNG/JPG with transparent background works best. Shown in sidebar & login page.</div>
        </div>

        <Field label="Company name">
          <Input value={s.company_name} onChange={(e) => setS({ ...s, company_name: e.target.value })} data-testid="settings-company-input" />
        </Field>
        <Field label="Currency">
          <Input value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })} maxLength={3} data-testid="settings-currency-input" />
        </Field>
        <Field label="Expense final-approval threshold (₹)" hint="Expenses above this need Management's final approval. Below or equal, Accounts' Stage-1 auto-completes the expense.">
          <Input type="number" value={s.approval_threshold} onChange={(e) => setS({ ...s, approval_threshold: e.target.value })} data-testid="settings-threshold-input" />
        </Field>
        <div className="pt-2">
          <Button onClick={save} className="bg-emerald-900 hover:bg-emerald-800" data-testid="save-settings-btn">Save changes</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-sm font-medium text-stone-800">{label}</label>
      {hint && <div className="text-xs text-stone-500 mt-0.5">{hint}</div>}
      <div className="mt-2">{children}</div>
    </div>
  );
}
