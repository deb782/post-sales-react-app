import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth, can } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Building2, Plus, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";

const IMAGES = [
  "https://images.pexels.com/photos/20273065/pexels-photo-20273065.jpeg",
  "https://images.pexels.com/photos/1816030/pexels-photo-1816030.jpeg",
];

export default function Projects() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", location: "", description: "", target_revenue: 0 });
  const [delId, setDelId] = useState(null);
  const [impact, setImpact] = useState(null);

  const load = async () => {
    const { data } = await api.get("/projects");
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.post("/projects", { ...form, target_revenue: Number(form.target_revenue) || 0 });
      toast.success("Project created");
      setOpen(false);
      setForm({ name: "", location: "", description: "", target_revenue: 0 });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="new-project-btn" className="bg-emerald-900 hover:bg-emerald-800">
                <Plus className="w-4 h-4 mr-1" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Project</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input data-testid="project-name-input" placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <Input type="number" placeholder="Target revenue (₹)" value={form.target_revenue} onChange={(e) => setForm({ ...form, target_revenue: e.target.value })} />
              </div>
              <DialogFooter>
                <Button data-testid="save-project-btn" onClick={save} className="bg-emerald-900 hover:bg-emerald-800">Create</Button>
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
                <div className="text-xs uppercase tracking-widest text-stone-500">Target</div>
                <div className="text-sm font-semibold">₹{Number(p.target_revenue || 0).toLocaleString("en-IN")}</div>
              </div>
              {can(user, "admin") && (
                <Button
                  variant="ghost"
                  onClick={() => askDelete(p)}
                  data-testid={`delete-project-${idx}`}
                  className="text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
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
