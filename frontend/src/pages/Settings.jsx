import { useEffect, useRef, useState } from "react";
import { api, API_BASE, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Image as ImageIcon, Trash2, Plus, X, FileText } from "lucide-react";
import { useBranding } from "@/lib/branding";

export default function Settings() {
  const [s, setS] = useState({ approval_threshold: 50000, currency: "INR", company_name: "Agrocorp Admin", logo_file_id: null });
  const [templates, setTemplates] = useState([]);
  const [open, setOpen] = useState(false);
  const [tpl, setTpl] = useState({ name: "", description: "", stages: [{ name: "Booking / ATS", percent: 30, days_from_start: 0 }] });
  const fileRef = useRef();
  const { refresh: refreshBrand } = useBranding();

  const load = async () => {
    const [ss, tt] = await Promise.all([
      api.get("/settings"),
      api.get("/payment-templates"),
    ]);
    setS(ss.data);
    setTemplates(tt.data);
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
    } catch (e) { toast.error(apiError(e)); }
  };

  const uploadLogo = async (f) => {
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    try { await api.post("/files/logo", fd); toast.success("Logo updated"); await load(); refreshBrand(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const clearLogo = async () => {
    try { await api.patch("/settings", { logo_file_id: "" }); toast.success("Logo removed"); await load(); refreshBrand(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const addStage = () => setTpl(t => ({ ...t, stages: [...t.stages, { name: "", percent: 0, days_from_start: 0 }] }));
  const rmStage = (i) => setTpl(t => ({ ...t, stages: t.stages.filter((_, x) => x !== i) }));
  const updStage = (i, k, v) => setTpl(t => { const n = [...t.stages]; n[i] = { ...n[i], [k]: v }; return { ...t, stages: n }; });

  const saveTpl = async () => {
    const total = tpl.stages.reduce((s, x) => s + Number(x.percent || 0), 0);
    if (Math.abs(total - 100) > 0.01) return toast.error(`Stages must sum to 100% (got ${total})`);
    try {
      await api.post("/payment-templates", {
        name: tpl.name, description: tpl.description,
        stages: tpl.stages.map(s => ({ name: s.name, percent: Number(s.percent) || 0, days_from_start: Number(s.days_from_start) || 0 })),
      });
      toast.success("Template saved");
      setOpen(false);
      setTpl({ name: "", description: "", stages: [{ name: "Booking / ATS", percent: 30, days_from_start: 0 }] });
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const delTpl = async (id) => {
    if (!window.confirm("Delete this template? Existing schedules aren't affected.")) return;
    try { await api.delete(`/payment-templates/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const logoUrl = s.logo_file_id ? `${API_BASE}/files/${s.logo_file_id}/download?ts=${Date.now()}` : null;
  const total = tpl.stages.reduce((sum, x) => sum + Number(x.percent || 0), 0);

  return (
    <div className="space-y-8" data-testid="settings-root">
      <div>
        <div className="text-xs uppercase tracking-widest text-stone-500">System</div>
        <h1 className="text-4xl font-bold text-stone-900 mt-1">Settings</h1>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-6 max-w-2xl space-y-6">
        <div>
          <div className="text-sm font-semibold text-stone-800 mb-3">Branding</div>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg border border-stone-200 bg-stone-50 flex items-center justify-center overflow-hidden">
              {logoUrl ? <img src={logoUrl} alt="logo" className="w-full h-full object-contain" data-testid="settings-logo-preview" /> : <ImageIcon className="w-8 h-8 text-stone-300" />}
            </div>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={(e) => uploadLogo(e.target.files?.[0])} data-testid="logo-file-input" />
              <Button variant="outline" onClick={() => fileRef.current?.click()} data-testid="upload-logo-btn"><Upload className="w-4 h-4 mr-1" /> Upload logo</Button>
              {s.logo_file_id && (
                <Button variant="outline" onClick={clearLogo} className="text-rose-700"><Trash2 className="w-4 h-4 mr-1" /> Remove</Button>
              )}
            </div>
          </div>
        </div>

        <Field label="Company name"><Input value={s.company_name} onChange={(e) => setS({ ...s, company_name: e.target.value })} data-testid="settings-company-input" /></Field>
        <Field label="Currency"><Input value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })} maxLength={3} data-testid="settings-currency-input" /></Field>
        <Field label="Expense final-approval threshold (₹)" hint="Above this, Management's final approval is required.">
          <Input type="number" value={s.approval_threshold} onChange={(e) => setS({ ...s, approval_threshold: e.target.value })} data-testid="settings-threshold-input" />
        </Field>
        <div className="pt-2">
          <Button onClick={save} className="bg-emerald-900 hover:bg-emerald-800" data-testid="save-settings-btn">Save changes</Button>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-6" data-testid="templates-section">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-stone-800">Payment plan templates</div>
            <div className="text-xs text-stone-500 mt-0.5">CRM applies these when scheduling installments for a booked plot.</div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-900 hover:bg-emerald-800" data-testid="new-template-btn"><Plus className="w-4 h-4 mr-1" /> New template</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Payment plan template</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Field label="Name">
                  <Input placeholder="30% ATS + 6 time-linked" value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} data-testid="tpl-name" />
                </Field>
                <Field label="Description">
                  <Textarea rows={2} placeholder="When to use this plan" value={tpl.description} onChange={(e) => setTpl({ ...tpl, description: e.target.value })} />
                </Field>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs uppercase tracking-widest text-stone-500">Stages · sum must be 100%</div>
                    <Button size="sm" variant="ghost" onClick={addStage} data-testid="add-stage-btn"><Plus className="w-3 h-3 mr-1" /> Add stage</Button>
                  </div>
                  <div className="space-y-2">
                    {tpl.stages.map((st, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center" data-testid={`stage-row-${i}`}>
                        <Input className="col-span-5" placeholder="Stage name (e.g. On construction)" value={st.name} onChange={(e) => updStage(i, "name", e.target.value)} />
                        <Input className="col-span-3" type="number" placeholder="% of total" value={st.percent} onChange={(e) => updStage(i, "percent", e.target.value)} />
                        <Input className="col-span-3" type="number" placeholder="Days from start" value={st.days_from_start} onChange={(e) => updStage(i, "days_from_start", e.target.value)} />
                        <Button size="icon" variant="ghost" className="col-span-1" onClick={() => rmStage(i)}><X className="w-4 h-4" /></Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-right"><b className={Math.abs(total - 100) < 0.01 ? "text-emerald-800" : "text-rose-700"}>Total: {total}%</b></div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={saveTpl} className="bg-emerald-900 hover:bg-emerald-800" data-testid="save-template-btn">Save template</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map(t => (
            <div key={t.template_id} className="p-4 rounded-lg border border-stone-200 hover:border-stone-300 transition-colors" data-testid={`template-card-${t.template_id}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-emerald-800 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-stone-900">{t.name}</div>
                    {t.description && <div className="text-xs text-stone-500 mt-0.5 line-clamp-2">{t.description}</div>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => delTpl(t.template_id)} className="text-rose-700"><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {t.stages.map((s, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                    {s.name} · {s.percent}% · Day {s.days_from_start}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <div className="col-span-full text-stone-500 text-sm border border-dashed border-stone-300 rounded-lg p-6 text-center">
              No templates yet. Create your first plan to speed up CRM scheduling.
            </div>
          )}
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
