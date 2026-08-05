import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { useProjectFilter } from "@/components/ProjectFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { HandCoins, Search, Ban, FileText } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

const fmt = (n = 0) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function Sales() {
  const { ProjectFilter, projectId, projects } = useProjectFilter();
  const nav = useNavigate();
  const [units, setUnits] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [q, setQ] = useState("");
  const [sellFor, setSellFor] = useState(null);
  const [sell, setSell] = useState({ owner_name: "", owner_contact: "", owner_email: "", discount: 0, total_price: 0, payment_plan_template_id: "" });
  const [cancelFor, setCancelFor] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

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
  const available = units.filter(u => u.status === "available");
  const filtered = available.filter(u => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (u.plot_number || "").toLowerCase().includes(s) || (projMap[u.project_id] || "").toLowerCase().includes(s);
  });

  const plcTotal = (u) => (u.plcs || []).reduce((s, p) => s + Number(p.amount || 0), 0);

  const openSell = (u) => {
    setSellFor(u);
    setSell({ owner_name: "", owner_contact: "", owner_email: "", discount: 0, total_price: Number(u.price || 0) + plcTotal(u), payment_plan_template_id: "" });
  };

  const doSell = async () => {
    if (!sell.owner_name || !sell.total_price) return toast.error("Owner name and total price required");
    try {
      await api.post(`/units/${sellFor.unit_id}/sell`, {
        ...sell,
        owner_email: sell.owner_email || null,
        discount: Number(sell.discount) || 0,
        total_price: Number(sell.total_price),
        payment_plan_template_id: sell.payment_plan_template_id || null,
      });
      toast.success("Sale booked — CRM notified via email");
      setSellFor(null);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const sold = units.filter(u => ["booked_pending_sales_approval","sale_confirmed","post_sales_active","fully_paid","registration_pending","registered","possession_pending","possession_completed","cancellation_requested"].includes(u.status));

  const submitCancellation = async () => {
    if (!cancelReason.trim()) return toast.error("Reason is required");
    try {
      await api.post(`/units/${cancelFor.unit_id}/request-cancellation`, { reason: cancelReason });
      toast.success("Cancellation request submitted for Sales Head review");
      setCancelFor(null); setCancelReason("");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="sales-root">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500">Sales pipeline</div>
          <h1 className="text-4xl font-bold text-stone-900 mt-1">Book a plot</h1>
          <p className="mt-1 text-stone-500 text-sm">Pick an available plot, capture the buyer, and hand off to CRM.</p>
        </div>
        <ProjectFilter />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryTile label="Available" value={available.length} tone="stone" />
        <SummaryTile label="Sold this pipeline" value={sold.length} tone="amber" />
        <SummaryTile label="Payment templates ready" value={templates.length} tone="emerald" />
      </div>

      <div className="bg-white border border-stone-200 rounded-xl">
        <div className="p-4 border-b border-stone-200 flex items-center gap-3">
          <Search className="w-4 h-4 text-stone-400" />
          <Input placeholder="Search by plot or project…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm border-0 shadow-none focus-visible:ring-0 px-0" data-testid="sales-search" />
          <div className="ml-auto text-xs text-stone-500">{filtered.length} available</div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plot</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Facing</TableHead>
              <TableHead>Base + PLCs</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(u => (
              <TableRow key={u.unit_id} data-testid={`sales-row-${u.plot_number}`}>
                <TableCell className="font-medium">{u.plot_number}</TableCell>
                <TableCell className="text-stone-600">{projMap[u.project_id] || "—"}</TableCell>
                <TableCell>{u.size || "—"}</TableCell>
                <TableCell>{u.facing || "—"}</TableCell>
                <TableCell>
                  <div>{fmt(Number(u.price || 0) + plcTotal(u))}</div>
                  {plcTotal(u) > 0 && <div className="text-[10px] text-stone-500">Base {fmt(u.price)} + PLCs {fmt(plcTotal(u))}</div>}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => openSell(u)} className="bg-emerald-900 hover:bg-emerald-800" data-testid={`book-btn-${u.plot_number}`}>
                    <HandCoins className="w-3.5 h-3.5 mr-1" /> Book plot
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-stone-500">
                No available plots — inventory is fully booked or you haven't added units yet.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl">
        <div className="p-4 border-b border-stone-200 flex items-center gap-3">
          <div className="text-sm font-semibold text-stone-900">Recent bookings</div>
          <div className="ml-auto text-xs text-stone-500">{sold.length} in pipeline</div>
        </div>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Plot</TableHead><TableHead>Project</TableHead><TableHead>Owner</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Details</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {sold.slice(0, 20).map(u => (
              <TableRow key={u.unit_id}>
                <TableCell className="font-medium">{u.plot_number}</TableCell>
                <TableCell className="text-stone-600">{projMap[u.project_id] || "—"}</TableCell>
                <TableCell>{u.owner_name || "—"}</TableCell>
                <TableCell>{fmt(u.total_price || u.price || 0)}</TableCell>
                <TableCell><span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-800">{u.status.replace(/_/g," ")}</span></TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    {u.status !== "cancellation_requested" && u.status !== "possession_completed" && (
                      <Button size="sm" variant="ghost" className="text-rose-700 hover:text-rose-800" onClick={() => setCancelFor(u)} data-testid={`req-cancel-${u.plot_number}`}>
                        <Ban className="w-3.5 h-3.5 mr-1" /> Cancel
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => nav(`/cost-sheet/${u.unit_id}`)} data-testid={`cost-sheet-${u.plot_number}`}>
                      <FileText className="w-3.5 h-3.5 mr-1" /> Cost Sheet
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => nav(`/crm/${u.unit_id}`)}>View in CRM →</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sold.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-stone-500">No bookings yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!cancelFor} onOpenChange={(o) => !o && setCancelFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request cancellation · Plot {cancelFor?.plot_number}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="text-stone-600">Owner: <b className="text-stone-900">{cancelFor?.owner_name}</b></div>
            <div className="text-xs text-stone-500">
              This will move the plot to <b>Cancellation requested</b> until a Sales Head reviews it.
              If approved, Accounts will refund the amount received to date in full.
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-500">Reason *</label>
              <Textarea rows={3} className="mt-1" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Customer request, non-payment, financing failed…" data-testid="cancel-reason-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelFor(null)}>Back</Button>
            <Button className="bg-rose-700 hover:bg-rose-800" onClick={submitCancellation} disabled={!cancelReason.trim()} data-testid="cancel-submit-btn">Submit request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sellFor} onOpenChange={(o) => !o && setSellFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Book plot {sellFor?.plot_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Owner name *"><Input value={sell.owner_name} onChange={(e) => setSell({ ...sell, owner_name: e.target.value })} data-testid="sales-owner-name" /></Field>
              <Field label="Contact"><Input value={sell.owner_contact} onChange={(e) => setSell({ ...sell, owner_contact: e.target.value })} /></Field>
              <div className="col-span-2"><Field label="Email"><Input type="email" value={sell.owner_email} onChange={(e) => setSell({ ...sell, owner_email: e.target.value })} /></Field></div>
              <Field label="Discount ₹"><Input type="number" value={sell.discount} onChange={(e) => setSell({ ...sell, discount: e.target.value })} /></Field>
              <Field label="Total price ₹ *"><Input type="number" value={sell.total_price} onChange={(e) => setSell({ ...sell, total_price: e.target.value })} data-testid="sales-total-price" /></Field>
            </div>
            <Field label="Payment plan template">
              <Select value={sell.payment_plan_template_id || "__none__"} onValueChange={(v) => setSell({ ...sell, payment_plan_template_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Optional — CRM will pick" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Let CRM decide —</SelectItem>
                  {templates.map(t => <SelectItem key={t.template_id} value={t.template_id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellFor(null)}>Cancel</Button>
            <Button onClick={doSell} className="bg-emerald-900 hover:bg-emerald-800" data-testid="sales-confirm-btn">Book plot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-stone-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function SummaryTile({ label, value, tone }) {
  const cls = tone === "emerald" ? "bg-emerald-50 border-emerald-200 text-emerald-900" :
    tone === "amber" ? "bg-amber-50 border-amber-200 text-amber-900" :
    "bg-white border-stone-200 text-stone-900";
  return (
    <div className={`p-5 rounded-xl border-2 ${cls}`}>
      <div className="text-[11px] uppercase tracking-widest text-stone-500">{label}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}
