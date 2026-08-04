import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, API_BASE, apiError } from "@/lib/api";
import { useAuth, canSetup } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Trash2, MapPin, Pencil, Home, TreePine, IndianRupee, HardHat, TicketCheck, PackageOpen, UserPlus } from "lucide-react";
import { toast } from "sonner";

const IMAGES = [
  "https://images.pexels.com/photos/20273065/pexels-photo-20273065.jpeg",
  "https://images.pexels.com/photos/1816030/pexels-photo-1816030.jpeg",
];

const TYPE_ICONS = { residential: Home, plots_land: TreePine };
const TYPE_LABELS = { residential: "Residential", plots_land: "Plots / Land" };

const BLANK = {
  name: "", project_type: "residential", location: "", address: "",
  city: "", state: "", pincode: "", developer: "", rera_number: "",
  start_date: "", expected_completion: "", total_units_planned: 0,
  site_manager_id: "",
};

const fmt = (n = 0) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function Projects() {
  const { user } = useAuth();
  const loc = useLocation();
  const [items, setItems] = useState([]);
  const [rollup, setRollup] = useState({});
  const [siteManagers, setSiteManagers] = useState([]);
  const [open, setOpen] = useState(!!loc.state?.openCreate);
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [delId, setDelId] = useState(null);
  const [impact, setImpact] = useState(null);
  const [newSm, setNewSm] = useState(null);

  const load = async () => {
    const [{ data: projects }, { data: dash }] = await Promise.all([
      api.get("/projects"),
      api.get("/dashboard/summary").catch(() => ({ data: { per_project: [] } })),
    ]);
    setItems(projects);
    const map = {};
    for (const r of dash?.per_project || []) map[r.project_id] = r;
    setRollup(map);
    if (canSetup(user)) {
      try {
        const { data: users } = await api.get("/users");
        setSiteManagers(users.filter(u => u.role === "site_supervisor" && u.is_active));
      } catch (_e) { /* ignore */ }
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const smMap = useMemo(() => Object.fromEntries(siteManagers.map(s => [s.user_id, s])), [siteManagers]);

  const save = async () => {
    try {
      const body = {
        ...form,
        total_units_planned: Number(form.total_units_planned) || 0,
        site_manager_id: form.site_manager_id || null,
      };
      let created;
      if (editing) {
        const { data } = await api.patch(`/projects/${editing.project_id}`, body);
        created = data;
        toast.success("Project updated");
      } else {
        const { data } = await api.post("/projects", body);
        created = data;
        toast.success("Project created");
      }
      // If a site manager is set, add this project to their scope
      if (created?.site_manager_id && created?.project_id) {
        const sm = smMap[created.site_manager_id];
        if (sm && !(sm.project_ids || []).includes(created.project_id)) {
          const nextIds = Array.from(new Set([...(sm.project_ids || []), created.project_id]));
          await api.patch(`/users/${sm.user_id}`, { project_ids: nextIds }).catch(() => {});
        }
      }
      setOpen(false); setEditing(null); setForm(BLANK);
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const startEdit = (p) => {
    setEditing(p);
    setForm({ ...BLANK, ...p, site_manager_id: p.site_manager_id || "" });
    setOpen(true);
  };

  const uploadImage = async (projectId, file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post(`/projects/${projectId}/image`, fd);
      toast.success("Image uploaded");
      if (editing && editing.project_id === projectId) {
        setForm(f => ({ ...f, image_url: data.image_url }));
      }
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const askDelete = async (p) => {
    setDelId(p.project_id);
    try {
      const { data } = await api.get(`/projects/${p.project_id}/impact`);
      setImpact(data);
    } catch (_e) { /* ignore */ }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/projects/${delId}`);
      toast.success("Project deleted");
      setDelId(null); setImpact(null); load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const inviteSm = async () => {
    if (!newSm?.name || !newSm?.email) return toast.error("Name and email required");
    try {
      const { data } = await api.post("/users", { ...newSm, role: "site_supervisor" });
      toast.success(`Invited ${data.user.name}`);
      setSiteManagers(prev => [...prev, data.user]);
      setForm(f => ({ ...f, site_manager_id: data.user.user_id }));
      setNewSm(null);
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="projects-root">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500">Portfolio</div>
          <h1 className="text-4xl font-bold text-stone-900 mt-1">Projects</h1>
          <p className="mt-1 text-stone-500 text-sm">{items.length} active project{items.length !== 1 && "s"} across your portfolio</p>
        </div>
        {canSetup(user) && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(BLANK); } }}>
            <DialogTrigger asChild>
              <Button data-testid="new-project-btn" className="bg-emerald-900 hover:bg-emerald-800">
                <Plus className="w-4 h-4 mr-1" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl">{editing ? "Edit project" : "New project"}</DialogTitle>
                <div className="text-xs text-stone-500 mt-1">Just the essentials — you can enrich later from the project page.</div>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-500">Project type</label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => {
                      const Icon = TYPE_ICONS[k];
                      const active = form.project_type === k;
                      return (
                        <button key={k} type="button" onClick={() => setForm({ ...form, project_type: k })}
                          className={`p-4 rounded-lg border-2 text-left transition-all ${active ? "border-emerald-900 bg-emerald-50" : "border-stone-200 hover:border-stone-300"}`}
                          data-testid={`type-${k}`}>
                          <Icon className={`w-5 h-5 mb-2 ${active ? "text-emerald-900" : "text-stone-500"}`} />
                          <div className={`font-semibold text-sm ${active ? "text-emerald-900" : "text-stone-900"}`}>{v}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Project name" required>
                    <Input data-testid="project-name-input" placeholder="Marine Heights" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </Field>
                  <Field label="Developer">
                    <Input placeholder="Agrocorp Pvt Ltd" value={form.developer} onChange={(e) => setForm({ ...form, developer: e.target.value })} />
                  </Field>
                  <Field label="Location / Area">
                    <Input placeholder="Bandra West" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                  </Field>
                  <Field label="City">
                    <Input placeholder="Mumbai" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </Field>
                  <Field label="State">
                    <Input placeholder="Maharashtra" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                  </Field>
                  <Field label="Pincode">
                    <Input placeholder="400050" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
                  </Field>
                  <Field label="RERA number">
                    <Input placeholder="P51800012345" value={form.rera_number} onChange={(e) => setForm({ ...form, rera_number: e.target.value })} />
                  </Field>
                  <Field label="Total plots planned">
                    <Input type="number" placeholder="120" value={form.total_units_planned} onChange={(e) => setForm({ ...form, total_units_planned: e.target.value })} />
                  </Field>
                  <Field label="Start date">
                    <Input type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                  </Field>
                  <Field label="Expected completion">
                    <Input type="date" value={form.expected_completion || ""} onChange={(e) => setForm({ ...form, expected_completion: e.target.value })} />
                  </Field>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-500">Site Manager</label>
                  <div className="flex gap-2 mt-2">
                    <Select value={form.site_manager_id || "__none__"} onValueChange={(v) => setForm({ ...form, site_manager_id: v === "__none__" ? "" : v })}>
                      <SelectTrigger data-testid="site-manager-select" className="flex-1"><SelectValue placeholder="Select Site Manager" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Unassigned —</SelectItem>
                        {siteManagers.map(sm => (
                          <SelectItem key={sm.user_id} value={sm.user_id}>{sm.name} · {sm.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={() => setNewSm({ name: "", email: "", phone: "" })} data-testid="invite-sm-inline-btn">
                      <UserPlus className="w-4 h-4 mr-1" /> Invite new
                    </Button>
                  </div>
                  {newSm && (
                    <div className="mt-3 p-3 rounded-lg border border-stone-200 bg-stone-50 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <Input placeholder="Full name" value={newSm.name} onChange={(e) => setNewSm({ ...newSm, name: e.target.value })} data-testid="new-sm-name" />
                        <Input placeholder="Email" value={newSm.email} onChange={(e) => setNewSm({ ...newSm, email: e.target.value })} data-testid="new-sm-email" />
                        <Input placeholder="Phone" value={newSm.phone} onChange={(e) => setNewSm({ ...newSm, phone: e.target.value })} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setNewSm(null)}>Cancel</Button>
                        <Button size="sm" className="bg-emerald-900 hover:bg-emerald-800" onClick={inviteSm} data-testid="confirm-new-sm-btn">Invite & assign</Button>
                      </div>
                    </div>
                  )}
                </div>

                {editing && (
                  <div className="flex items-center gap-4 p-3 rounded-md border border-stone-200 bg-stone-50">
                    <div className="w-24 h-16 rounded-md border border-stone-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
                      {form.image_url ? (
                        <img src={form.image_url.startsWith("/api") ? `${API_BASE}${form.image_url.replace("/api", "")}` : form.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (<Building2 className="w-6 h-6 text-stone-300" />)}
                    </div>
                    <div className="min-w-0">
                      <label className="text-xs uppercase tracking-widest text-stone-500">Cover image</label>
                      <input type="file" accept="image/*" onChange={(e) => uploadImage(editing.project_id, e.target.files?.[0])} className="mt-1 block text-sm text-stone-700 file:mr-3 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-emerald-900 file:text-white hover:file:bg-emerald-800" />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button data-testid="save-project-btn" onClick={save} className="bg-emerald-900 hover:bg-emerald-800">{editing ? "Save changes" : "Create project"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {items.map((p, idx) => {
          const r = rollup[p.project_id] || {};
          const sm = smMap[p.site_manager_id];
          const Icon = TYPE_ICONS[p.project_type] || Building2;
          return (
            <div key={p.project_id} className="group bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow" data-testid={`project-card-${idx}`}>
              <div className="h-36 bg-stone-200 relative">
                <img src={p.image_url ? (p.image_url.startsWith("/api") ? `${API_BASE}${p.image_url.replace("/api","")}` : p.image_url) : IMAGES[idx % IMAGES.length]} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900/70 to-transparent" />
                <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur px-2.5 py-1 text-[10px] font-medium text-stone-700 uppercase tracking-wider">
                  <Icon className="w-3 h-3" /> {TYPE_LABELS[p.project_type] || "Project"}
                </div>
                <div className="absolute bottom-3 left-4 right-4 text-white">
                  <div className="text-lg font-semibold">{p.name}</div>
                  <div className="text-xs flex items-center gap-1 text-stone-200"><MapPin className="w-3 h-3" /> {p.location || p.city || "—"}</div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Metric icon={PackageOpen} label="Units" value={`${r.units_sold ?? 0}/${r.units_total ?? p.total_units_planned ?? 0}`} sub="sold / total" />
                  <Metric icon={IndianRupee} label="Received" value={fmt(r.received || 0)} sub={r.receivable ? `${fmt(r.receivable)} due` : "—"} tone="emerald" />
                  <Metric icon={HardHat} label="Site Manager" value={sm?.name || <span className="text-stone-400 font-normal">Unassigned</span>} sub={sm?.email || "—"} textSize="sm" />
                  <Metric icon={TicketCheck} label="Tickets" value={r.tickets_open ?? 0} sub="open" />
                </div>

                {canSetup(user) && (
                  <div className="flex justify-end gap-1 border-t border-stone-100 pt-3">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(p)} data-testid={`edit-project-${idx}`} className="text-stone-700"><Pencil className="w-4 h-4 mr-1" /> Edit</Button>
                    {user.role === "admin" && (
                      <Button size="sm" variant="ghost" onClick={() => askDelete(p)} data-testid={`delete-project-${idx}`} className="text-rose-700 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="col-span-full text-stone-500 text-sm border border-dashed border-stone-300 rounded-xl p-10 text-center flex flex-col items-center gap-2">
            <Building2 className="w-8 h-8 text-stone-300" /> No projects yet.
          </div>
        )}
      </div>

      <Dialog open={!!delId} onOpenChange={(o) => !o && (setDelId(null), setImpact(null))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete project?</DialogTitle></DialogHeader>
          {impact && (
            <div className="text-sm space-y-2">
              <p className="text-stone-600">This will remove:</p>
              <ul className="text-stone-800 space-y-1">
                <li>• {impact.users} user(s) assigned {impact.users > 0 && <span className="text-rose-700">(will block delete)</span>}</li>
                <li>• {impact.units} units</li>
                <li>• {impact.payments} payments</li>
                <li>• {impact.expenses} expenses</li>
                <li>• {impact.stock_items} stock items</li>
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDelId(null); setImpact(null); }}>Cancel</Button>
            <Button data-testid="confirm-delete-project-btn" className="bg-rose-600 hover:bg-rose-700 text-white" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, required }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-stone-500">
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub, tone, textSize }) {
  const valCls = tone === "emerald" ? "text-emerald-800" : "text-stone-900";
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-stone-500">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`mt-0.5 font-semibold truncate ${valCls} ${textSize === "sm" ? "text-sm" : "text-base"}`}>{value}</div>
      <div className="text-[10px] text-stone-500 truncate">{sub}</div>
    </div>
  );
}
