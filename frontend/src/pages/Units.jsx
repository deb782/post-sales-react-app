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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Home, X, MoreHorizontal, Layers, FileSpreadsheet, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { downloadExcel, downloadPdf } from "@/lib/exporters";

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
  const [statusF, setStatusF] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ project_id: "", unit_type_id: "", unit_number: "", price: 0 });
  const [openType, setOpenType] = useState(false);
  const [typeForm, setTypeForm] = useState({ project_id: "", name: "", default_price: 0 });
  const [openBulk, setOpenBulk] = useState(false);
  const [bulk, setBulk] = useState({ project_id: "", unit_type_id: "", prefix: "A-", start: 101, end: 110, pad: 0, base_price: 0 });
  const [sellFor, setSellFor] = useState(null);
  const [sell, setSell] = useState({ buyer_name: "", buyer_contact: "", total_price: 0 });
  const [reserveFor, setReserveFor] = useState(null);
  const [reserve, setReserve] = useState({ buyer_name: "", buyer_contact: "", reserved_until: "", total_price: 0 });

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

  const filtered = units.filter(u => {
    if (statusF && u.status !== statusF) return false;
    if (q) {
      const s = q.toLowerCase();
      return u.unit_number.toLowerCase().includes(s) ||
        (u.buyer_name || "").toLowerCase().includes(s);
    }
    return true;
  });

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

  const doBulk = async () => {
    try {
      const { data } = await api.post("/units/bulk", {
        project_id: bulk.project_id,
        unit_type_id: bulk.unit_type_id || null,
        prefix: bulk.prefix,
        start: Number(bulk.start),
        end: Number(bulk.end),
        pad: Number(bulk.pad) || 0,
        base_price: Number(bulk.base_price) || 0,
      });
      toast.success(`Created ${data.created} unit(s)${data.skipped.length ? `, skipped ${data.skipped.length}` : ""}`);
      setOpenBulk(false);
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

  const doReserve = async () => {
    try {
      await api.post(`/units/${reserveFor.unit_id}/reserve`, {
        buyer_name: reserve.buyer_name,
        buyer_contact: reserve.buyer_contact,
        reserved_until: reserve.reserved_until || null,
        total_price: Number(reserve.total_price) || null,
      });
      toast.success("Unit reserved");
      setReserveFor(null);
      setReserve({ buyer_name: "", buyer_contact: "", reserved_until: "", total_price: 0 });
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const doRelease = async (u) => {
    if (!window.confirm(`Release ${u.unit_number}? Reservation for ${u.buyer_name} will be cleared.`)) return;
    try {
      await api.post(`/units/${u.unit_id}/release`);
      toast.success("Reservation released");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const cancelSale = async (u) => {
    if (!window.confirm("Cancel this sale?")) return;
    await api.post(`/units/${u.unit_id}/cancel`);
    toast.success("Sale cancelled");
    load();
  };

  const exportXlsx = () => downloadExcel("/exports/units", projectId ? { project_id: projectId } : {}, "units.xlsx");
  const exportPdf = () => {
    const headers = ["Unit", "Project", "Type", "Price", "Status", "Buyer"];
    const rows = filtered.map(u => [
      u.unit_number, projMap[u.project_id] || "",
      typeMap[u.unit_type_id] || "", `₹${Number(u.price || 0).toLocaleString("en-IN")}`,
      u.status, u.buyer_name || "",
    ]);
    downloadPdf("Units", headers, rows, "units.pdf");
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="export-units-btn"><Download className="w-4 h-4 mr-1" /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportXlsx}><FileSpreadsheet className="w-4 h-4 mr-2" /> Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPdf}><FileText className="w-4 h-4 mr-2" /> PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

              <Dialog open={openBulk} onOpenChange={setOpenBulk}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="bulk-units-btn"><Layers className="w-4 h-4 mr-1" /> Bulk Create</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Bulk Create Units</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Select value={bulk.project_id} onValueChange={(v) => setBulk({ ...bulk, project_id: v })}>
                      <SelectTrigger data-testid="bulk-project-select"><SelectValue placeholder="Project" /></SelectTrigger>
                      <SelectContent>{projects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={bulk.unit_type_id} onValueChange={(v) => setBulk({ ...bulk, unit_type_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Unit type (optional)" /></SelectTrigger>
                      <SelectContent>
                        {types.filter(t => !bulk.project_id || t.project_id === bulk.project_id).map(t => (
                          <SelectItem key={t.unit_type_id} value={t.unit_type_id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="Prefix (e.g. A-)" value={bulk.prefix} onChange={(e) => setBulk({ ...bulk, prefix: e.target.value })} data-testid="bulk-prefix-input" />
                      <Input type="number" placeholder="Zero padding (e.g. 3)" value={bulk.pad} onChange={(e) => setBulk({ ...bulk, pad: e.target.value })} />
                      <Input type="number" placeholder="Start #" value={bulk.start} onChange={(e) => setBulk({ ...bulk, start: e.target.value })} data-testid="bulk-start-input" />
                      <Input type="number" placeholder="End #" value={bulk.end} onChange={(e) => setBulk({ ...bulk, end: e.target.value })} data-testid="bulk-end-input" />
                    </div>
                    <Input type="number" placeholder="Base price ₹ (applied to all)" value={bulk.base_price} onChange={(e) => setBulk({ ...bulk, base_price: e.target.value })} />
                    <div className="text-xs text-stone-500">
                      Preview: <span className="font-mono text-stone-700">
                        {bulk.prefix}{String(bulk.start || "").padStart(Number(bulk.pad) || 0, "0")}
                        {" … "}
                        {bulk.prefix}{String(bulk.end || "").padStart(Number(bulk.pad) || 0, "0")}
                      </span>
                    </div>
                  </div>
                  <DialogFooter><Button data-testid="confirm-bulk-btn" onClick={doBulk} className="bg-emerald-900 hover:bg-emerald-800">Create</Button></DialogFooter>
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
        <div className="p-4 border-b border-stone-200 flex flex-wrap gap-3 items-center">
          <Input placeholder="Search unit number or buyer…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" data-testid="units-search" />
          <Select value={statusF || "all"} onValueChange={(v) => setStatusF(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40" data-testid="units-status-filter"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="reserved">Reserved</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-stone-500">{filtered.length} of {units.length}</div>
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
                  {u.status === "reserved" && u.reserved_until && (
                    <div className="text-[10px] text-amber-700 mt-0.5">until {u.reserved_until}</div>
                  )}
                </TableCell>
                <TableCell className="text-stone-600">{u.buyer_name || "—"}</TableCell>
                <TableCell className="text-right">
                  {can(user, "admin") && (u.status === "available" || u.status === "reserved") && (
                    <div className="flex items-center gap-2 justify-end">
                      <Button size="sm" onClick={() => { setSellFor(u); setSell({ buyer_name: u.buyer_name || "", buyer_contact: u.buyer_contact || "", total_price: u.price }); }} className="bg-emerald-900 hover:bg-emerald-800" data-testid={`sell-unit-${u.unit_number}`}>Mark Sold</Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="px-2"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {u.status === "available" && (
                            <DropdownMenuItem onClick={() => { setReserveFor(u); setReserve({ buyer_name: "", buyer_contact: "", reserved_until: "", total_price: u.price }); }}>
                              Reserve
                            </DropdownMenuItem>
                          )}
                          {u.status === "reserved" && (
                            <DropdownMenuItem onClick={() => doRelease(u)}>Release reservation</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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
          <DialogHeader><DialogTitle>Mark unit sold {sellFor?.unit_number && `— ${sellFor.unit_number}`}</DialogTitle></DialogHeader>
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

      <Dialog open={!!reserveFor} onOpenChange={(o) => !o && setReserveFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reserve unit {reserveFor?.unit_number && `— ${reserveFor.unit_number}`}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Buyer name" value={reserve.buyer_name} onChange={(e) => setReserve({ ...reserve, buyer_name: e.target.value })} data-testid="reserve-buyer-input" />
            <Input placeholder="Buyer contact" value={reserve.buyer_contact} onChange={(e) => setReserve({ ...reserve, buyer_contact: e.target.value })} />
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-500">Reserved until</label>
              <Input type="date" value={reserve.reserved_until} onChange={(e) => setReserve({ ...reserve, reserved_until: e.target.value })} data-testid="reserve-until-input" />
            </div>
            <Input type="number" placeholder="Total price ₹ (optional)" value={reserve.total_price} onChange={(e) => setReserve({ ...reserve, total_price: e.target.value })} />
            <div className="text-xs text-stone-500">Release is manual — reservation stays until you release or convert to sale.</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReserveFor(null)}>Cancel</Button>
            <Button data-testid="confirm-reserve-btn" onClick={doReserve} className="bg-amber-600 hover:bg-amber-700 text-white">Reserve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
