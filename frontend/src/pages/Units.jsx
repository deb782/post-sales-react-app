import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth, can } from "@/lib/auth";
import { useProjectFilter } from "@/components/ProjectFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Home, X } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLE = {
  available: "bg-stone-100 text-stone-700 border-stone-200",
  reserved: "bg-amber-100 text-amber-800 border-amber-200",
  sold: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200",
};

export default function Units() {
  const { user } = useAuth();
  const { ProjectFilter, projectId, projects } = useProjectFilter();
  const [units, setUnits] = useState([]);
  const [types, setTypes] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ project_id: "", unit_type_id: "", unit_number: "", price: 0 });
  const [openType, setOpenType] = useState(false);
  const [typeForm, setTypeForm] = useState({ project_id: "", name: "", default_price: 0 });
  const [sellFor, setSellFor] = useState(null);
  const [sell, setSell] = useState({ buyer_name: "", buyer_contact: "", total_price: 0 });

  const load = async () => {
    const params = projectId ? { project_id: projectId } : {};
    const [u, t] = await Promise.all([
      api.get("/units", { params }),
      api.get("/unit-types", { params }),
    ]);
    setUnits(u.data);
    setTypes(t.data);
  };
  useEffect(() => { load(); }, [projectId]);

  const typeMap = useMemo(() => Object.fromEntries(types.map(t => [t.unit_type_id, t.name])), [types]);
  const projMap = useMemo(() => Object.fromEntries(projects.map(p => [p.project_id, p.name])), [projects]);

  const filtered = units.filter(u =>
    !q || u.unit_number.toLowerCase().includes(q.toLowerCase()) ||
    (u.buyer_name || "").toLowerCase().includes(q.toLowerCase())
  );

  const saveUnit = async () => {
    try {
      await api.post("/units", {
        project_id: form.project_id,
        unit_type_id: form.unit_type_id || null,
        unit_number: form.unit_number,
        price: Number(form.price) || 0,
      });
      toast.success("Unit created");
      setOpen(false);
      setForm({ project_id: "", unit_type_id: "", unit_number: "", price: 0 });
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const saveType = async () => {
    try {
      await api.post("/unit-types", { ...typeForm, default_price: Number(typeForm.default_price) || 0 });
      toast.success("Unit type added");
      setOpenType(false); setTypeForm({ project_id: "", name: "", default_price: 0 });
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const doSell = async () => {
    try {
      await api.post(`/units/${sellFor.unit_id}/sell`, {
        buyer_name: sell.buyer_name,
        buyer_contact: sell.buyer_contact,
        total_price: Number(sell.total_price) || null,
      });
      toast.success("Unit marked sold");
      setSellFor(null); setSell({ buyer_name: "", buyer_contact: "", total_price: 0 });
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const cancelSale = async (u) => {
    if (!window.confirm("Cancel this sale?")) return;
    await api.post(`/units/${u.unit_id}/cancel`);
    toast.success("Sale cancelled");
    load();
  };

  return (
    <div className="space-y-6" data-testid="units-root">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500">Inventory</div>
          <h1 className="text-4xl font-bold text-stone-900 mt-1">Units</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ProjectFilter />
          {can(user, "admin") && (
            <>
              <Dialog open={openType} onOpenChange={setOpenType}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="new-unit-type-btn"><Plus className="w-4 h-4 mr-1" /> Unit Type</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Unit Type</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Select value={typeForm.project_id} onValueChange={(v) => setTypeForm({ ...typeForm, project_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
                      <SelectContent>
                        {projects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Name (e.g. 2BHK, Villa)" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} />
                    <Input type="number" placeholder="Default price ₹" value={typeForm.default_price} onChange={(e) => setTypeForm({ ...typeForm, default_price: e.target.value })} />
                  </div>
                  <DialogFooter><Button onClick={saveType} className="bg-emerald-900 hover:bg-emerald-800">Create</Button></DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="new-unit-btn" className="bg-emerald-900 hover:bg-emerald-800"><Plus className="w-4 h-4 mr-1" /> New Unit</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Unit</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
                      <SelectContent>{projects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={form.unit_type_id} onValueChange={(v) => setForm({ ...form, unit_type_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Unit type (optional)" /></SelectTrigger>
                      <SelectContent>
                        {types.filter(t => !form.project_id || t.project_id === form.project_id).map(t => (
                          <SelectItem key={t.unit_type_id} value={t.unit_type_id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Unit number (e.g. A-101)" value={form.unit_number} onChange={(e) => setForm({ ...form, unit_number: e.target.value })} />
                    <Input type="number" placeholder="Price ₹" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </div>
                  <DialogFooter><Button data-testid="save-unit-btn" onClick={saveUnit} className="bg-emerald-900 hover:bg-emerald-800">Create</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl">
        <div className="p-4 border-b border-stone-200">
          <Input placeholder="Search unit number or buyer…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" data-testid="units-search" />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.unit_id} data-testid={`unit-row-${u.unit_number}`}>
                <TableCell className="font-medium">{u.unit_number}</TableCell>
                <TableCell className="text-stone-600">{projMap[u.project_id] || "—"}</TableCell>
                <TableCell>{typeMap[u.unit_type_id] || "—"}</TableCell>
                <TableCell>₹{Number(u.price || 0).toLocaleString("en-IN")}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[u.status]}`}>{u.status}</span>
                </TableCell>
                <TableCell className="text-stone-600">{u.buyer_name || "—"}</TableCell>
                <TableCell className="text-right">
                  {can(user, "admin") && u.status !== "sold" && u.status !== "cancelled" && (
                    <Button size="sm" onClick={() => { setSellFor(u); setSell({ buyer_name: "", buyer_contact: "", total_price: u.price }); }} className="bg-emerald-900 hover:bg-emerald-800" data-testid={`sell-unit-${u.unit_number}`}>Mark Sold</Button>
                  )}
                  {can(user, "admin") && u.status === "sold" && (
                    <Button size="sm" variant="outline" onClick={() => cancelSale(u)} className="text-rose-700"><X className="w-3 h-3 mr-1" /> Cancel</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-stone-500">
                <Home className="w-6 h-6 mx-auto mb-2 text-stone-300" /> No units yet
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!sellFor} onOpenChange={(o) => !o && setSellFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark unit sold</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Buyer name" value={sell.buyer_name} onChange={(e) => setSell({ ...sell, buyer_name: e.target.value })} data-testid="buyer-name-input" />
            <Input placeholder="Buyer contact" value={sell.buyer_contact} onChange={(e) => setSell({ ...sell, buyer_contact: e.target.value })} />
            <Input type="number" placeholder="Total price ₹" value={sell.total_price} onChange={(e) => setSell({ ...sell, total_price: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellFor(null)}>Cancel</Button>
            <Button data-testid="confirm-sell-btn" onClick={doSell} className="bg-emerald-900 hover:bg-emerald-800">Confirm sale</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
