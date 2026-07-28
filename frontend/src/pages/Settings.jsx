import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Settings() {
  const [s, setS] = useState({ approval_threshold: 50000, currency: "INR", company_name: "Estate OS" });

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
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <div className="space-y-6" data-testid="settings-root">
      <div>
        <div className="text-xs uppercase tracking-widest text-stone-500">System</div>
        <h1 className="text-4xl font-bold text-stone-900 mt-1">Settings</h1>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-6 max-w-2xl space-y-4">
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
