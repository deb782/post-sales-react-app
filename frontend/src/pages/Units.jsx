import { useEffect, useMemo, useState } from "react";
import { api, API_BASE, apiError } from "@/lib/api";
import { useAuth, can, canSetup } from "@/lib/auth";
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
import { Plus, Home, Pencil, Trash2, X, Upload, Download, FileSpreadsheet, FileText, HandCoins } from "lucide-react";
import { toast } from "sonner";
import { downloadExcel, downloadPdf } from "@/lib/exporters";

const STATUS_STYLE = {
  available: "bg-stone-100 text-stone-700 border-stone-200",
  sold: "bg-amber-100 text-amber-800 border-amber-200",
  crm_pending: "bg-blue-100 text-blue-800 border-blue-200",
  crm_scheduled: "bg-indigo-100 text-indigo-800 border-indigo-200",
  accounts_tracking: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200",
};

const STATUS_LABELS = {
  available: "Available",
  sold: "Sold",
  crm_pending: "CRM Pending",
  crm_scheduled: "Scheduled",
  accounts_tracking: "Tracking Payments",
  cancelled: "Cancelled",
};

const FACING = ["North","East","South","West","North-East","North-West","South-East","South-West"];

const BLANK_UNIT = { plot_number: "", size: "", facing: "", price: 0, plcs: [] };
const fmt = (n = 0) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function Units() {
  const { user } = useAuth();
  const { ProjectFilter, projectId, projects } = useProjectFilter();
  const [units, setUnits] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK_UNIT, project_id: "" });
  const [editing, setEditing] = useState(null);
  const [openBulk, setOpenBulk] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkProject, setBulkProject] = useState("");
  const [bulkResult, setBulkResult] = useState(null);
  const [sellFor, setSellFor] = useState(null);
  const [sell, setSell] = useState({ owner_name: "", owner_contact: "", owner_email: "", discount: 0, total_price: 0, payment_plan_template_id: "" });

  const load = async () => {
    const params = projectId ? { project_id: projectId } : {};
    const [u, t] = await Promise.all([
      api.get("/units", { params }),
      api.get("/payment-templates").catch(() => ({ data: [] })),
    ]);
    setUnits(u.data);
    setTemplates(t.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  const projMap = useMemo(() => Object.fromEntries(projects.map(p => [p.project_id, p.name])), [projects]);

  const filtered = units.filter(u => {
    if (statusF && u.status !== statusF) return false;
    if (q) {
      const s = q.toLowerCase();
      return (u.plot_number || "").toLowerCase().includes(s) ||
        (u.owner_name || "").toLowerCase().includes(s);
    }
    return true;
  });

  const plcTotal = (u) => (u.plcs || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const displayPrice = (u) => (u.total_price && u.status !== "available") ? u.total_price : (Number(u.price || 0) + plcTotal(u));

  const saveUnit = async () => {
    try {
      const body = {
        project_id: editing ? undefined : form.project_id,
        plot_number: form.plot_number,
        size: form.size,
        facing: form.facing,
        price: Number(form.price) || 0,
        plcs: (form.plcs || []).map(p => ({ label: p.label, amount: Number(p.amount) || 0 })),
      };
      if (editing) {
        await api.patch(`/units/${editing.unit_id}`, body);
        toast.success("Unit updated");
      } else {
        await api.post("/units", body);
        toast.success("Unit created");
      }
      setOpen(false); setEditing(null); setForm({ ...BLANK_UNIT, project_id: "" });
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const startEdit = (u) => {
    setEditing(u);
    setForm({ project_id: u.project_id, plot_number: u.plot_number, size: u.size || "", facing: u.facing || "", price: u.price || 0, plcs: u.plcs || [] });
    setOpen(true);
  };

  const addPLC = () => setForm(f => ({ ...f, plcs: [...(f.plcs || []), { label: "", amount: 0 }] }));
  const updPLC = (i, k, v) => setForm(f => {
    const next = [...f.plcs]; next[i] = { ...next[i], [k]: v }; return { ...f, plcs: next };
  });
  const rmPLC = (i) => setForm(f => ({ ...f, plcs: f.plcs.filter((_, x) => x !== i) }));

  const doBulk = async () => {
    if (!bulkFile || !bulkProject) return toast.error("Choose project and file");
    try {
      const fd = new FormData();
      fd.append("project_id", bulkProject);
      fd.append("file", bulkFile);
      const { data } = await api.post("/units/bulk-import", fd);
      setBulkResult(data);
      toast.success(`Imported ${data.inserted} unit(s)`);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const downloadTemplate = async () => {
    const token = localStorage.getItem("access_token");
    const r = await fetch(`${API_BASE}/units/bulk-template`, {
      headers: { Authorization: `Bearer ${token}` }, credentials: "include",
    });
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "units_template.xlsx"; a.click();
  };

  const doSell = async () => {
    if (!sell.owner_name || !sell.total_price) return toast.error("Owner name and total price required");
    try {
      await api.post(`/units/${sellFor.unit_id}/sell`, {
        owner_name: sell.owner_name,
        owner_contact: sell.owner_contact,
        owner_email: sell.owner_email || null,
        discount: Number(sell.discount) || 0,
        total_price: Number(sell.total_price),
        payment_plan_template_id: sell.payment_plan_template_id || null,
      });
      toast.success("Sale booked — CRM notified");
      setSellFor(null);
      setSell({ owner_name: "", owner_contact: "", owner_email: "", discount: 0, total_price: 0, payment_plan_template_id: "" });
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const openSell = (u) => {
    const base = Number(u.price || 0) + plcTotal(u);
    setSellFor(u);
    setSell({ owner_name: "", owner_contact: "", owner_email: "", discount: 0, total_price: base, payment_plan_template_id: "" });
  };

  const cancelSale = async (u) => {
    if (!window.confirm("Cancel this sale and return unit to inventory?")) return;
    try {
      await api.post(`/units/${u.unit_id}/cancel-sale`);
      toast.success("Sale cancelled");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const exportXlsx = () => downloadExcel("/exports/units", projectId ? { project_id: projectId } : {}, "units.xlsx");
  const exportPdf = () => {
    const headers = ["Plot", "Project", "Size", "Facing", "Price", "Status", "Owner"];
    const rows = filtered.map(u => [
      u.plot_number, projMap[u.project_id] || "",
      u.size || "", u.facing || "", fmt(displayPrice(u)), STATUS_LABELS[u.status] || u.status, u.owner_name || "",
    ]);
    downloadPdf("Units", headers, rows, "units.pdf");
  };

  return (
    <div className="space-y-6" data-testid="units-root">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500">Inventory</div>
          <h1 className="text-4xl font-bold text-stone-900 mt-1">Units / Plots</h1>
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
          {canSetup(user) && (
            <>
              <Dialog open={openBulk} onOpenChange={setOpenBulk}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="bulk-import-btn"><Upload className="w-4 h-4 mr-1" /> Bulk Import</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Bulk Import Units</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-600">
                      <div className="font-medium text-stone-800 mb-1">Expected columns:</div>
                      <code>plot_number, size, facing, price</code>
                      <Button variant="ghost" size="sm" className="mt-2 text-emerald-800 h-6 px-1" onClick={downloadTemplate} data-testid="download-template-btn">
                        Download template →
                      </Button>
                    </div>
                    <Select value={bulkProject} onValueChange={setBulkProject}>
                      <SelectTrigger data-testid="bulk-project-select"><SelectValue placeholder="Select project" /></SelectTrigger>
                      <SelectContent>
                        {projects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="file" accept=".xlsx,.csv" onChange={(e) => setBulkFile(e.target.files?.[0] || null)} data-testid="bulk-file-input" />
                    {bulkResult && (
                      <div className="p-3 rounded-lg border border-stone-200 bg-white text-xs">
                        Inserted <b className="text-emerald-800">{bulkResult.inserted}</b> · Errors <b className={bulkResult.errors.length ? "text-rose-700" : ""}>{bulkResult.errors.length}</b>
                        {bulkResult.errors.length > 0 && (
                          <ul className="mt-2 space-y-0.5 max-h-32 overflow-y-auto">
                            {bulkResult.errors.slice(0, 10).map((er, i) => <li key={i}>Row {er.row}: {er.error}</li>)}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button onClick={doBulk} disabled={!bulkFile || !bulkProject} className="bg-emerald-900 hover:bg-emerald-800" data-testid="confirm-bulk-btn">
                      <Upload className="w-4 h-4 mr-1" /> Import
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ ...BLANK_UNIT, project_id: "" }); } }}>
                <DialogTrigger asChild>
                  <Button data-testid="new-unit-btn" className="bg-emerald-900 hover:bg-emerald-800"><Plus className="w-4 h-4 mr-1" /> New Unit</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>{editing ? "Edit Unit" : "New Unit"}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    {!editing && (
                      <div>
                        <label className="text-xs uppercase tracking-widest text-stone-500">Project</label>
                        <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                          <SelectTrigger data-testid="unit-project-select" className="mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                          <SelectContent>{projects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs uppercase tracking-widest text-stone-500">Plot number</label>
                        <Input className="mt-1" placeholder="P-101" value={form.plot_number} onChange={(e) => setForm({ ...form, plot_number: e.target.value })} data-testid="unit-plot-number" />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-widest text-stone-500">Size</label>
                        <Input className="mt-1" placeholder="1200 sqft / 30x40" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} data-testid="unit-size" />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-widest text-stone-500">Facing</label>
                        <Select value={form.facing || "__none__"} onValueChange={(v) => setForm({ ...form, facing: v === "__none__" ? "" : v })}>
                          <SelectTrigger className="mt-1" data-testid="unit-facing"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— None —</SelectItem>
                            {FACING.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-widest text-stone-500">Base price ₹</label>
                        <Input type="number" className="mt-1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} data-testid="unit-price" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs uppercase tracking-widest text-stone-500">PLCs (preferential location charges)</label>
                        <Button size="sm" variant="ghost" onClick={addPLC} data-testid="add-plc-btn"><Plus className="w-3 h-3 mr-1" /> Add PLC</Button>
                      </div>
                      {(form.plcs || []).length === 0 && <div className="text-xs text-stone-400">None added</div>}
                      <div className="space-y-2">
                        {(form.plcs || []).map((p, i) => (
                          <div key={i} className="flex items-center gap-2" data-testid={`plc-row-${i}`}>
                            <Input placeholder="Label (e.g. Corner)" value={p.label} onChange={(e) => updPLC(i, "label", e.target.value)} className="flex-1" />
                            <Input type="number" placeholder="₹" value={p.amount} onChange={(e) => updPLC(i, "amount", e.target.value)} className="w-32" />
                            <Button size="icon" variant="ghost" onClick={() => rmPLC(i)}><X className="w-4 h-4" /></Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button data-testid="save-unit-btn" onClick={saveUnit} className="bg-emerald-900 hover:bg-emerald-800">{editing ? "Save changes" : "Create"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl">
        <div className="p-4 border-b border-stone-200 flex flex-wrap gap-3 items-center">
          <Input placeholder="Search plot number or owner…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" data-testid="units-search" />
          <Select value={statusF || "all"} onValueChange={(v) => setStatusF(v === "all" ? "" : v)}>
            <SelectTrigger className="w-44" data-testid="units-status-filter"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-stone-500">{filtered.length} of {units.length}</div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plot</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Facing</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.unit_id} data-testid={`unit-row-${u.plot_number}`}>
                <TableCell className="font-medium">{u.plot_number}</TableCell>
                <TableCell className="text-stone-600">{projMap[u.project_id] || "—"}</TableCell>
                <TableCell>{u.size || "—"}</TableCell>
                <TableCell>{u.facing || "—"}</TableCell>
                <TableCell>{fmt(displayPrice(u))}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[u.status] || ""}`}>{STATUS_LABELS[u.status] || u.status}</span>
                </TableCell>
                <TableCell className="text-stone-600">{u.owner_name || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    {can(user, "admin", "sales", "management") && u.status === "available" && (
                      <Button size="sm" onClick={() => openSell(u)} className="bg-emerald-900 hover:bg-emerald-800" data-testid={`sell-unit-${u.plot_number}`}>
                        <HandCoins className="w-3.5 h-3.5 mr-1" /> Mark Sold
                      </Button>
                    )}
                    {canSetup(user) && u.status === "available" && (
                      <Button size="icon" variant="ghost" onClick={() => startEdit(u)} data-testid={`edit-unit-${u.plot_number}`}><Pencil className="w-3.5 h-3.5" /></Button>
                    )}
                    {canSetup(user) && ["crm_pending", "sold"].includes(u.status) && (
                      <Button size="sm" variant="outline" onClick={() => cancelSale(u)} className="text-rose-700"><X className="w-3 h-3 mr-1" /> Cancel</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-stone-500">
                <Home className="w-6 h-6 mx-auto mb-2 text-stone-300" /> No units yet
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!sellFor} onOpenChange={(o) => !o && setSellFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Book plot {sellFor?.plot_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-500">Owner name *</label>
                <Input className="mt-1" value={sell.owner_name} onChange={(e) => setSell({ ...sell, owner_name: e.target.value })} data-testid="owner-name-input" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-500">Contact</label>
                <Input className="mt-1" value={sell.owner_contact} onChange={(e) => setSell({ ...sell, owner_contact: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="text-xs uppercase tracking-widest text-stone-500">Email</label>
                <Input type="email" className="mt-1" value={sell.owner_email} onChange={(e) => setSell({ ...sell, owner_email: e.target.value })} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-500">Discount ₹</label>
                <Input type="number" className="mt-1" value={sell.discount} onChange={(e) => setSell({ ...sell, discount: e.target.value })} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-500">Total price ₹ *</label>
                <Input type="number" className="mt-1" value={sell.total_price} onChange={(e) => setSell({ ...sell, total_price: e.target.value })} data-testid="total-price-input" />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-500">Payment plan template</label>
              <Select value={sell.payment_plan_template_id || "__none__"} onValueChange={(v) => setSell({ ...sell, payment_plan_template_id: v === "__none__" ? "" : v })}>
                <SelectTrigger data-testid="template-select" className="mt-1"><SelectValue placeholder="CRM will pick if left blank" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Let CRM decide —</SelectItem>
                  {templates.map(t => <SelectItem key={t.template_id} value={t.template_id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-stone-500 border-t border-stone-100 pt-3">
              CRM will build the payment schedule from this template. Admin, Accounts, and CRM will be notified via email + in-app.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellFor(null)}>Cancel</Button>
            <Button data-testid="confirm-sell-btn" onClick={doSell} className="bg-emerald-900 hover:bg-emerald-800">Book plot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
