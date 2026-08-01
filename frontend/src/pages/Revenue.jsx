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
import { Plus, Wallet, Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { downloadExcel, downloadPdf } from "@/lib/exporters";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import RevenueTargets from "@/components/RevenueTargets";

const fmt = (n = 0) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function Revenue() {
  const { user } = useAuth();
  const { ProjectFilter, projectId, projects: allProjects } = useProjectFilter();
  const [summary, setSummary] = useState({ accrued: 0, received: 0, receivable: 0, by_unit: [] });
  const [payments, setPayments] = useState([]);
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState({ unit_id: "", amount: 0, mode: "bank_transfer", reference: "", paid_on: new Date().toISOString().slice(0,10) });

  const load = async () => {
    const params = projectId ? { project_id: projectId } : {};
    const [s, p, u] = await Promise.all([
      api.get("/revenue/summary", { params }),
      api.get("/payments", { params }),
      api.get("/units", { params }),
    ]);
    setSummary(s.data);
    setPayments(p.data);
    setUnits(u.data.filter(x => ["sold","crm_pending","crm_scheduled","accounts_tracking"].includes(x.status)));
  };
  useEffect(() => { load(); }, [projectId]);

  const unitLabel = useMemo(() => Object.fromEntries(units.map(u => [u.unit_id, u.plot_number])), [units]);

  const save = async () => {
    try {
      await api.post("/payments", {
        unit_id: form.unit_id,
        amount: Number(form.amount) || 0,
        mode: form.mode,
        reference: form.reference,
        paid_on: form.paid_on,
      });
      toast.success("Payment recorded");
      setOpen(false); setForm({ ...form, amount: 0, reference: "" });
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <div className="space-y-6" data-testid="revenue-root">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500">Cashflow</div>
          <h1 className="text-4xl font-bold text-stone-900 mt-1">Revenue</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ProjectFilter />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="export-payments-btn"><Download className="w-4 h-4 mr-1" /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => downloadExcel("/exports/payments", projectId ? { project_id: projectId } : {}, "payments.xlsx")}><FileSpreadsheet className="w-4 h-4 mr-2" /> Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadPdf("Payments", ["Date","Unit","Amount","Mode","Reference"], payments.map(p => [p.paid_on, unitLabel[p.unit_id] || "", fmt(p.amount), p.mode, p.reference || ""]), "payments.pdf")}><FileText className="w-4 h-4 mr-2" /> PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {can(user, "admin", "accounts") && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="new-payment-btn" className="bg-emerald-900 hover:bg-emerald-800"><Plus className="w-4 h-4 mr-1" /> Record Payment</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
                    <SelectTrigger data-testid="payment-unit-select"><SelectValue placeholder="Sold unit" /></SelectTrigger>
                    <SelectContent>
                      {units.map(u => <SelectItem key={u.unit_id} value={u.unit_id}>{u.plot_number} — {u.owner_name || "—"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Amount ₹" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["cash","cheque","bank_transfer","upi","card","other"].map(m => <SelectItem key={m} value={m}>{m.replace("_"," ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Reference / cheque #" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                  <Input type="date" value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} />
                </div>
                <DialogFooter><Button data-testid="save-payment-btn" onClick={save} className="bg-emerald-900 hover:bg-emerald-800">Save</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card label="Accrued" value={fmt(summary.accrued)} />
        <Card label="Received" value={fmt(summary.received)} tone="emerald" />
        <Card label="Receivable" value={fmt(summary.receivable)} tone="amber" />
      </div>

      <RevenueTargets projectId={projectId} projects={allProjects} />

      <div className="bg-white border border-stone-200 rounded-xl">
        <div className="px-4 py-3 border-b border-stone-200 font-semibold text-sm">Payments Log</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map(p => (
              <TableRow key={p.payment_id}>
                <TableCell>{p.paid_on}</TableCell>
                <TableCell className="font-medium">{unitLabel[p.unit_id] || p.unit_id}</TableCell>
                <TableCell>{fmt(p.amount)}</TableCell>
                <TableCell className="capitalize">{p.mode.replace("_"," ")}</TableCell>
                <TableCell className="text-stone-600">{p.reference || "—"}</TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-stone-500">
                <Wallet className="w-6 h-6 mx-auto mb-2 text-stone-300" /> No payments recorded
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl">
        <div className="px-4 py-3 border-b border-stone-200 font-semibold text-sm">Per-Unit Receivables</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Accrued</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Receivable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.by_unit.filter(r => r.accrued > 0).map(r => (
              <TableRow key={r.unit_id}>
                <TableCell className="font-medium">{r.unit_number}</TableCell>
                <TableCell><span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-800 border-emerald-200">{r.status}</span></TableCell>
                <TableCell>{fmt(r.accrued)}</TableCell>
                <TableCell>{fmt(r.received)}</TableCell>
                <TableCell className={r.receivable > 0 ? "text-amber-800 font-medium" : "text-emerald-800 font-medium"}>{fmt(r.receivable)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Card({ label, value, tone }) {
  const cls = tone === "emerald" ? "text-emerald-800" : tone === "amber" ? "text-amber-800" : "text-stone-900";
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${cls}`}>{value}</div>
    </div>
  );
}
