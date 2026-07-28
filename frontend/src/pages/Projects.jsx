import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth, can } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Building2, Plus, Trash2, MapPin, Pencil, Home, Landmark, TreePine, Layers } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const IMAGES = [
  "https://images.pexels.com/photos/20273065/pexels-photo-20273065.jpeg",
  "https://images.pexels.com/photos/1816030/pexels-photo-1816030.jpeg",
];

const TYPE_ICONS = { residential: Home, commercial: Landmark, plot: TreePine, villa: Building2, mixed: Layers };
const TYPE_LABELS = { residential: "Residential", commercial: "Commercial", plot: "Plots/Land", villa: "Villas", mixed: "Mixed-use" };

const BLANK = { name: "", project_type: "residential", location: "", address: "", city: "", state: "", pincode: "", developer: "", rera_number: "", start_date: "", expected_completion: "", total_units_planned: 0, target_revenue: 0, description: "" };

export default function Projects() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [delId, setDelId] = useState(null);
  const [impact, setImpact] = useState(null);

  const load = async () => {
    const { data } = await api.get("/projects");
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const body = { ...form, target_revenue: Number(form.target_revenue) || 0, total_units_planned: Number(form.total_units_planned) || 0 };
      if (editing) {
        await api.patch(`/projects/${editing.project_id}`, body);
        toast.success("Project updated");
      } else {
        await api.post("/projects", body);
        toast.success("Project created");
      }
      setOpen(false); setEditing(null); setForm(BLANK);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  const startEdit = (p) => {
    setEditing(p);
    setForm({ ...BLANK, ...p });
    setOpen(true);
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
      toast.error(e?.response?.data?.detail || "Delete blocked");
    }
  };

  return (
    <div className="space-y-6" data-testid="projects-root">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500">Portfolio</div>
          <h1 className="text-4xl font-bold text-stone-900 mt-1">Projects</h1>
        </div>
        {can(user, "admin") && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(BLANK); } }}>
            <DialogTrigger asChild>
              <Button data-testid="new-project-btn" className="bg-emerald-900 hover:bg-emerald-800">
                <Plus className="w-4 h-4 mr-1" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Edit project" : "Create project"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs uppercase tracking-widest text-stone-500">Project type</label>
                  <div className="grid grid-cols-5 gap-2 mt-1">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => {
                      const Icon = TYPE_ICONS[k];
                      const active = form.project_type === k;
                      return (
                        <button key={k} type="button" onClick={() => setForm({...form, project_type: k})}
                          className={`p-2 rounded-md border text-xs flex flex-col items-center gap-1 transition-colors ${active ? "border-emerald-900 bg-emerald-50 text-emerald-900" : "border-stone-200 text-stone-600 hover:border-stone-300"}`}
                          data-testid={`edit-type-${k}`}>
                          <Icon className="w-4 h-4" /> {v}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Input data-testid="project-name-input" placeholder="Project name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Input placeholder="Developer" value={form.developer} onChange={(e) => setForm({ ...form, developer: e.target.value })} />
                <Input placeholder="Location / Area" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <Input placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                <Input placeholder="Pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
                <Textarea className="md:col-span-2" rows={2} placeholder="Full address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                <Input placeholder="RERA number" value={form.rera_number} onChange={(e) => setForm({ ...form, rera_number: e.target.value })} />
                <Input type="number" placeholder="Total units planned" value={form.total_units_planned} onChange={(e) => setForm({ ...form, total_units_planned: e.target.value })} />
                <Input type="date" placeholder="Start date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                <Input type="date" placeholder="Expected completion" value={form.expected_completion || ""} onChange={(e) => setForm({ ...form, expected_completion: e.target.value })} />
                <Input type="number" className="md:col-span-2" placeholder="Target revenue (₹)" value={form.target_revenue} onChange={(e) => setForm({ ...form, target_revenue: e.target.value })} />
                <Textarea className="md:col-span-2" rows={2} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <DialogFooter>
                <Button data-testid="save-project-btn" onClick={save} className="bg-emerald-900 hover:bg-emerald-800">{editing ? "Save changes" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {items.map((p, idx) => (
          <div key={p.project_id} className="group bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow" data-testid={`project-card-${idx}`}>
            <div className="h-40 bg-stone-200 relative">
              <img src={p.image_url || IMAGES[idx % IMAGES.length]} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 text-white">
                <div className="text-lg font-semibold">{p.name}</div>
                <div className="text-xs flex items-center gap-1 text-stone-200"><MapPin className="w-3 h-3" /> {p.location || "—"}</div>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {(() => { const I = TYPE_ICONS[p.project_type] || Building2; return <I className="w-3.5 h-3.5 text-stone-500" />; })()}
                  <span className="text-[10px] uppercase tracking-widest text-stone-500">{TYPE_LABELS[p.project_type] || "Project"}</span>
                </div>
                <div className="text-xs text-stone-500">Target</div>
                <div className="text-sm font-semibold">₹{Number(p.target_revenue || 0).toLocaleString("en-IN")}</div>
              </div>
              {can(user, "admin") && (
                <div className="flex gap-1">
                  <Button variant="ghost" onClick={() => startEdit(p)} data-testid={`edit-project-${idx}`} className="text-stone-700"><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" onClick={() => askDelete(p)} data-testid={`delete-project-${idx}`} className="text-rose-700 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></Button>
                </div>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full text-stone-500 text-sm border border-dashed border-stone-300 rounded-xl p-10 text-center flex flex-col items-center gap-2">
            <Building2 className="w-8 h-8 text-stone-300" />
            No projects yet.
          </div>
        )}
      </div>

      <Dialog open={!!delId} onOpenChange={(o) => !o && (setDelId(null), setImpact(null))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete project?</DialogTitle></DialogHeader>
          {impact && (
            <div className="text-sm space-y-2">
              <p className="text-stone-600">This will remove all related data:</p>
              <ul className="text-stone-800 space-y-1">
                <li>• {impact.users} user(s) assigned {impact.users > 0 && <span className="text-rose-700">(delete will be blocked)</span>}</li>
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
