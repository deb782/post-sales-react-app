import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, API_BASE, apiError } from "@/lib/api";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Check, ChevronRight, Building2, Home, Landmark, TreePine, Layers, Upload, UserPlus, Copy } from "lucide-react";

const TYPE_ICONS = {
  residential: Home, commercial: Landmark, plot: TreePine, villa: Building2, mixed: Layers,
};

export default function Onboarding() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [schemas, setSchemas] = useState({});
  const [proj, setProj] = useState(null);
  const [projForm, setProjForm] = useState({
    name: "", project_type: "residential", location: "", address: "",
    city: "", state: "", pincode: "", developer: "", rera_number: "",
    start_date: "", expected_completion: "", total_units_planned: 0,
    target_revenue: 0, description: "",
  });
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.get("/projects/types").then(r => setSchemas(r.data)).catch(() => {});
    api.get("/onboarding/status").then(r => {
      setStatus(r.data);
      if (r.data.system_ready && user?.onboarding_completed) nav("/dashboard", { replace: true });
    });
  }, [user, nav]);

  const reload = async () => setStatus((await api.get("/onboarding/status")).data);

  const createProject = async () => {
    try {
      const { data } = await api.post("/projects", {
        ...projForm,
        target_revenue: Number(projForm.target_revenue) || 0,
        total_units_planned: Number(projForm.total_units_planned) || 0,
      });
      setProj(data);
      toast.success("Project created");
      setStep(2);
      reload();
    } catch (e) { toast.error(apiError(e)); }
  };

  const finish = async () => {
    await api.post("/onboarding/complete");
    await refresh();
    nav("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-5xl mx-auto p-8">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-widest text-stone-500">First-run setup</div>
          <h1 className="text-4xl font-bold text-stone-900 mt-1">Let&apos;s set up your console</h1>
          <p className="text-stone-600 mt-2 text-sm max-w-2xl">
            A few essentials before you can go live: create your first project, load its inventory, and invite the rest of your team. This takes less than 5 minutes.
          </p>
        </div>

        <Stepper current={step} steps={["Project", "Inventory", "Team"]} />

        {step === 1 && (
          <div className="mt-8 bg-white border border-stone-200 rounded-xl p-6" data-testid="onboarding-step-1">
            <h2 className="text-xl font-bold text-stone-900 mb-1">Step 1 · Add your first project</h2>
            <p className="text-sm text-stone-500 mb-6">Choose the project type — this drives what inventory fields you&apos;ll capture (BHK vs plot dimensions vs commercial use-type, etc.).</p>

            <label className="text-xs uppercase tracking-widest text-stone-500">Project type</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-2 mb-6">
              {Object.entries(schemas).map(([k, s]) => {
                const Icon = TYPE_ICONS[k] || Building2;
                const active = projForm.project_type === k;
                return (
                  <button key={k} type="button"
                    onClick={() => setProjForm({ ...projForm, project_type: k })}
                    className={`text-left p-4 rounded-lg border-2 transition-colors ${active ? "border-emerald-900 bg-emerald-50" : "border-stone-200 bg-white hover:border-stone-300"}`}
                    data-testid={`type-${k}`}>
                    <Icon className={`w-5 h-5 mb-2 ${active ? "text-emerald-900" : "text-stone-500"}`} />
                    <div className={`font-semibold text-sm ${active ? "text-emerald-900" : "text-stone-900"}`}>{s.label}</div>
                    <div className="text-[11px] text-stone-500 mt-1 leading-snug">{s.description}</div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Project name" required><Input value={projForm.name} onChange={(e) => setProjForm({...projForm, name: e.target.value})} placeholder="Marine Heights" data-testid="proj-name-input" /></Field>
              <Field label="Developer / Company"><Input value={projForm.developer} onChange={(e) => setProjForm({...projForm, developer: e.target.value})} placeholder="Vista Estates Pvt Ltd" /></Field>
              <Field label="Location / Area"><Input value={projForm.location} onChange={(e) => setProjForm({...projForm, location: e.target.value})} placeholder="Bandra West" /></Field>
              <Field label="City"><Input value={projForm.city} onChange={(e) => setProjForm({...projForm, city: e.target.value})} placeholder="Mumbai" /></Field>
              <Field label="State"><Input value={projForm.state} onChange={(e) => setProjForm({...projForm, state: e.target.value})} placeholder="Maharashtra" /></Field>
              <Field label="Pincode"><Input value={projForm.pincode} onChange={(e) => setProjForm({...projForm, pincode: e.target.value})} placeholder="400050" /></Field>
              <Field label="Full address" full><Textarea rows={2} value={projForm.address} onChange={(e) => setProjForm({...projForm, address: e.target.value})} placeholder="Plot 27, Linking Road, Bandra West, Mumbai — 400050" /></Field>
              <Field label="RERA number"><Input value={projForm.rera_number} onChange={(e) => setProjForm({...projForm, rera_number: e.target.value})} placeholder="P51800012345" /></Field>
              <Field label="Total units planned"><Input type="number" value={projForm.total_units_planned} onChange={(e) => setProjForm({...projForm, total_units_planned: e.target.value})} /></Field>
              <Field label="Start date"><Input type="date" value={projForm.start_date} onChange={(e) => setProjForm({...projForm, start_date: e.target.value})} /></Field>
              <Field label="Expected completion"><Input type="date" value={projForm.expected_completion} onChange={(e) => setProjForm({...projForm, expected_completion: e.target.value})} /></Field>
              <Field label="Target revenue (₹)" full><Input type="number" value={projForm.target_revenue} onChange={(e) => setProjForm({...projForm, target_revenue: e.target.value})} placeholder="250000000" /></Field>
              <Field label="Description" full><Textarea rows={2} value={projForm.description} onChange={(e) => setProjForm({...projForm, description: e.target.value})} placeholder="Sea-facing premium tower with 3BHK & 4BHK apartments" /></Field>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={createProject} disabled={!projForm.name} className="bg-emerald-900 hover:bg-emerald-800" data-testid="create-first-project-btn">
                Create project <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && proj && (
          <InventoryStep project={proj} schema={schemas[proj.project_type]} onNext={() => { reload(); setStep(3); }} />
        )}

        {step === 3 && (
          <TeamStep project={proj} status={status} reload={reload} onFinish={finish} />
        )}
      </div>
    </div>
  );
}

function Stepper({ current, steps }) {
  return (
    <div className="flex items-center gap-3">
      {steps.map((s, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={s} className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${done ? "bg-emerald-900 text-white" : active ? "bg-white border-2 border-emerald-900 text-emerald-900" : "bg-stone-200 text-stone-500"}`}>
              {done ? <Check className="w-4 h-4" /> : n}
            </div>
            <div className={`text-sm ${active ? "font-semibold text-stone-900" : "text-stone-500"}`}>{s}</div>
            {n < steps.length && <div className={`w-12 h-0.5 ${done ? "bg-emerald-900" : "bg-stone-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children, required, full }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="text-xs uppercase tracking-widest text-stone-500">
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function InventoryStep({ project, schema, onNext }) {
  const [mode, setMode] = useState("manual");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState({ unit_number: "", unit_type: schema?.unit_types?.[0] || "", price: 0, attributes: {} });
  const [created, setCreated] = useState(0);

  const downloadTemplate = async () => {
    const token = localStorage.getItem("access_token");
    const r = await fetch(`${API_BASE}/units/bulk-template?project_type=${project.project_type}`,
      { headers: { Authorization: `Bearer ${token}` }, credentials: "include" });
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `units_${project.project_type}_template.xlsx`; a.click();
  };

  const doImport = async () => {
    if (!file) return toast.error("Choose a file");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("project_id", project.project_id);
      fd.append("file", file);
      const { data } = await api.post("/units/bulk-import", fd);
      setResult(data);
      toast.success(`Imported ${data.inserted} unit(s)`);
    } catch (e) { toast.error(apiError(e)); }
    finally { setBusy(false); }
  };

  const addManual = async () => {
    if (!manual.unit_number) return toast.error("Unit number required");
    try {
      // ensure unit type exists
      let utId = null;
      if (manual.unit_type) {
        const { data: types } = await api.get("/unit-types", { params: { project_id: project.project_id } });
        const found = types.find(t => t.name === manual.unit_type);
        if (found) utId = found.unit_type_id;
        else {
          const { data } = await api.post("/unit-types", { project_id: project.project_id, name: manual.unit_type, default_price: Number(manual.price) || 0 });
          utId = data.unit_type_id;
        }
      }
      await api.post("/units", {
        project_id: project.project_id,
        unit_type_id: utId,
        unit_number: manual.unit_number,
        price: Number(manual.price) || 0,
        attributes: manual.attributes,
      });
      setCreated(created + 1);
      toast.success(`Added ${manual.unit_number}`);
      setManual({ ...manual, unit_number: "", attributes: {} });
    } catch (e) { toast.error(apiError(e)); }
  };

  const setAttr = (k, v) => setManual({ ...manual, attributes: { ...manual.attributes, [k]: v } });

  return (
    <div className="mt-8 bg-white border border-stone-200 rounded-xl p-6" data-testid="onboarding-step-2">
      <h2 className="text-xl font-bold text-stone-900 mb-1">Step 2 · Load inventory into {project.name}</h2>
      <p className="text-sm text-stone-500 mb-4">Add units one at a time or upload an .xlsx / .csv in bulk. Fields shown here match your <b>{schema?.label}</b> project type.</p>

      <div className="flex gap-2 mb-6">
        <Button variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")} className={mode === "manual" ? "bg-emerald-900 hover:bg-emerald-800" : ""} data-testid="mode-manual-btn">Add manually</Button>
        <Button variant={mode === "bulk" ? "default" : "outline"} onClick={() => setMode("bulk")} className={mode === "bulk" ? "bg-emerald-900 hover:bg-emerald-800" : ""} data-testid="mode-bulk-btn">Bulk upload</Button>
      </div>

      {mode === "manual" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Unit number" required><Input value={manual.unit_number} onChange={(e) => setManual({...manual, unit_number: e.target.value})} placeholder="A-1201" data-testid="manual-unit-number" /></Field>
          <Field label="Unit type / Category">
            <Select value={manual.unit_type} onValueChange={(v) => setManual({...manual, unit_type: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{schema?.unit_types?.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Price (₹)" full><Input type="number" value={manual.price} onChange={(e) => setManual({...manual, price: e.target.value})} /></Field>
          {schema?.fields?.map(f => (
            <Field key={f.key} label={f.label}>
              {f.type === "select" ? (
                <Select value={manual.attributes[f.key] || ""} onValueChange={(v) => setAttr(f.key, v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{f.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              ) : f.type === "boolean" ? (
                <Select value={String(!!manual.attributes[f.key])} onValueChange={(v) => setAttr(f.key, v === "true")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
                </Select>
              ) : (
                <Input type={f.type === "number" ? "number" : "text"} value={manual.attributes[f.key] || ""}
                  onChange={(e) => setAttr(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)} />
              )}
            </Field>
          ))}
          <div className="md:col-span-2 flex items-center justify-between mt-2">
            <div className="text-sm text-stone-500">{created > 0 ? <><b className="text-emerald-800">{created}</b> unit{created !== 1 && "s"} added in this session</> : "No units added yet"}</div>
            <div className="flex gap-2">
              <Button onClick={addManual} className="bg-emerald-900 hover:bg-emerald-800" data-testid="add-unit-btn">Add unit</Button>
              <Button variant="outline" onClick={onNext} disabled={created === 0} data-testid="continue-to-team-btn">Continue <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </div>
        </div>
      )}

      {mode === "bulk" && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 text-sm text-stone-700">
            <div className="font-medium mb-1">Recommended workflow:</div>
            1. Download the template — it already has the right columns for a <b>{schema?.label}</b> project<br />
            2. Paste your inventory into the sheet (Excel or Google Sheets)<br />
            3. Save as .xlsx or export as .csv<br />
            4. Upload here — you&apos;ll see a per-row error report if any rows fail validation.
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="outline" onClick={downloadTemplate} data-testid="download-template-btn"><Upload className="w-4 h-4 mr-1 rotate-180" /> Download template</Button>
            <Input type="file" accept=".xlsx,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="max-w-md" data-testid="bulk-file-input" />
            <Button onClick={doImport} disabled={!file || busy} className="bg-emerald-900 hover:bg-emerald-800" data-testid="run-bulk-import-btn"><Upload className="w-4 h-4 mr-1" /> {busy ? "Importing…" : "Import"}</Button>
          </div>
          {result && (
            <div className="p-4 rounded-lg border border-stone-200 bg-white">
              <div className="text-sm">Inserted <b className="text-emerald-800">{result.inserted}</b> unit{result.inserted !== 1 && "s"}. Errors: <b className={result.errors.length ? "text-rose-700" : ""}>{result.errors.length}</b></div>
              {result.errors.length > 0 && (
                <ul className="mt-2 text-xs text-stone-600 max-h-40 overflow-y-auto space-y-1">
                  {result.errors.map((er, i) => <li key={i}>Row {er.row}: {er.error}</li>)}
                </ul>
              )}
              {result.inserted > 0 && (
                <div className="mt-3 flex justify-end">
                  <Button onClick={onNext} className="bg-emerald-900 hover:bg-emerald-800" data-testid="continue-after-bulk-btn">Continue to team <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamStep({ project, status, reload, onFinish }) {
  const [form, setForm] = useState({ email: "", name: "", role: "site_manager", phone: "", project_ids: project ? [project.project_id] : [] });
  const [lastInvite, setLastInvite] = useState(null);
  const roles = status?.steps || {};

  const submit = async () => {
    if (!form.email || !form.name) return toast.error("Email and name required");
    try {
      const { data } = await api.post("/users", form);
      setLastInvite(data);
      toast.success(`Invited ${data.user.name}${data.email_sent ? " — email sent" : ""}`);
      setForm({ email: "", name: "", role: form.role, phone: "", project_ids: project ? [project.project_id] : [] });
      reload();
    } catch (e) { toast.error(apiError(e)); }
  };

  const need = [
    { key: "has_accounts", role: "accounts", label: "Accounts" },
    { key: "has_management", role: "management", label: "Management" },
    { key: "has_site_manager", role: "site_manager", label: "Site Manager" },
  ];
  const done = need.every(n => roles[n.key]);

  return (
    <div className="mt-8 bg-white border border-stone-200 rounded-xl p-6" data-testid="onboarding-step-3">
      <h2 className="text-xl font-bold text-stone-900 mb-1">Step 3 · Assign your team</h2>
      <p className="text-sm text-stone-500 mb-4">You need at least one Accounts, one Management, and one Site Manager for the workflow to function. Each user gets an email with a temporary password.</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {need.map(n => (
          <div key={n.role} className={`p-3 rounded-lg border ${roles[n.key] ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="text-xs uppercase tracking-widest text-stone-500">{n.label}</div>
            <div className={`mt-1 flex items-center gap-1 text-sm font-medium ${roles[n.key] ? "text-emerald-800" : "text-amber-800"}`}>
              {roles[n.key] ? <><Check className="w-4 h-4" /> Assigned</> : "Pending"}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Full name" required><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Rahul Iyer" data-testid="invite-name-input" /></Field>
        <Field label="Work email" required><Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="rahul.iyer@company.com" data-testid="invite-email-input" /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="+91 98200 00000" /></Field>
        <Field label="Role" required>
          <Select value={form.role} onValueChange={(v) => setForm({...form, role: v})}>
            <SelectTrigger data-testid="invite-role-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="accounts">{ROLE_LABELS.accounts}</SelectItem>
              <SelectItem value="management">{ROLE_LABELS.management}</SelectItem>
              <SelectItem value="site_manager">{ROLE_LABELS.site_manager}</SelectItem>
              <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="mt-4 flex justify-between items-center">
        <div className="text-xs text-stone-500">Site Managers should be scoped to the project(s) they oversee — you can add more from the Users page later.</div>
        <div className="flex gap-2">
          <Button onClick={submit} className="bg-emerald-900 hover:bg-emerald-800" data-testid="invite-user-btn"><UserPlus className="w-4 h-4 mr-1" /> Invite</Button>
          <Button variant="outline" onClick={onFinish} disabled={!done} data-testid="finish-onboarding-btn">
            {done ? "Finish setup" : "All roles required"}
          </Button>
        </div>
      </div>

      {lastInvite && (
        <div className="mt-6 p-4 rounded-lg border border-emerald-200 bg-emerald-50" data-testid="invite-details">
          <div className="text-sm font-semibold text-emerald-900">Invite ready for {lastInvite.user.name}</div>
          <div className="mt-2 text-xs text-stone-700 space-y-1 font-mono">
            <div>Portal: {lastInvite.login_url}</div>
            <div>Login ID: {lastInvite.user.email}</div>
            <div>Temp password: {lastInvite.temp_password}</div>
          </div>
          {!lastInvite.email_sent && (
            <div className="mt-2 text-[11px] text-amber-800">
              SMTP not configured — copy the details above and share them manually. Configure SMTP in .env to auto-send.
            </div>
          )}
          <Button size="sm" variant="outline" className="mt-3" onClick={() => {
            navigator.clipboard.writeText(
              `Portal: ${lastInvite.login_url}\nLogin ID: ${lastInvite.user.email}\nTemporary password: ${lastInvite.temp_password}`);
            toast.success("Copied to clipboard");
          }} data-testid="copy-invite-btn"><Copy className="w-3 h-3 mr-1" /> Copy details</Button>
        </div>
      )}
    </div>
  );
}
