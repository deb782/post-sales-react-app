import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth, can } from "@/lib/auth";
import { useProjectFilter } from "@/components/ProjectFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Receipt, Check, X, Paperclip } from "lucide-react";
import { toast } from "sonner";

const fmt = (n = 0) => "₹" + Math.round(n).toLocaleString("en-IN");

function StatusPill({ status }) {
  const cls =
    status === "pending" ? "status-pending" :
    status === "stage1_approved" ? "status-stage1" :
    status === "final_approved" ? "status-final" :
    "status-reject";
  const label =
    status === "pending" ? "Pending" :
    status === "stage1_approved" ? "Stage 1 ✓" :
    status === "final_approved" ? "Final ✓" : "Rejected";
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

function StatusFlow({ status }) {
  const steps = [
    { key: "pending", label: "Raised" },
    { key: "stage1_approved", label: "Stage 1" },
    { key: "final_approved", label: "Final" },
  ];
  const idx =
    status === "final_approved" ? 3 :
    status === "stage1_approved" ? 2 :
    status === "rejected" ? -1 : 1;
  return (
    <div className="flex items-center gap-2 mt-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1 text-[10px]">
          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] ${i < idx ? "bg-emerald-800" : "bg-stone-300"}`}>
            {i < idx ? "✓" : i + 1}
          </div>
          <span className={i < idx ? "text-stone-900" : "text-stone-400"}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Expenses() {
  const { user } = useAuth();
  const { ProjectFilter, projectId, projects } = useProjectFilter();
  const [items, setItems] = useState([]);
  const [statusF, setStatusF] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ project_id: "", category: "", amount: 0, vendor: "", description: "", receipt_file_id: null });
  const [file, setFile] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectStage, setRejectStage] = useState("stage1");

  const load = async () => {
    const params = {};
    if (projectId) params.project_id = projectId;
    if (statusF) params.status = statusF;
    const { data } = await api.get("/expenses", { params });
    setItems(data);
  };
  useEffect(() => { load(); }, [projectId, statusF]);

  const projMap = useMemo(() => Object.fromEntries(projects.map(p => [p.project_id, p.name])), [projects]);

  const raise = async () => {
    try {
      let receipt_file_id = null;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const up = await api.post("/files/upload", fd);
        receipt_file_id = up.data.file_id;
      }
      await api.post("/expenses", {
        project_id: form.project_id,
        category: form.category,
        amount: Number(form.amount) || 0,
        vendor: form.vendor,
        description: form.description,
        receipt_file_id,
      });
      toast.success("Expense submitted for approval");
      setOpen(false); setFile(null);
      setForm({ project_id: "", category: "", amount: 0, vendor: "", description: "", receipt_file_id: null });
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const approve = async (e, stage) => {
    try {
      await api.post(`/expenses/${e.expense_id}/${stage}`, { action: "approve" });
      toast.success("Approved");
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const doReject = async () => {
    try {
      await api.post(`/expenses/${rejectFor.expense_id}/${rejectStage}`, { action: "reject", reason: rejectReason });
      toast.success("Rejected");
      setRejectFor(null); setRejectReason("");
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const canRaise = can(user, "site_manager", "admin");
  const canStage1 = can(user, "accounts", "admin");
  const canFinal = can(user, "management", "admin");

  return (
    <div className="space-y-6" data-testid="expenses-root">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500">Operations</div>
          <h1 className="text-4xl font-bold text-stone-900 mt-1">Expenses</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ProjectFilter />
          <Select value={statusF || "all"} onValueChange={(v) => setStatusF(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40 bg-white" data-testid="expense-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="stage1_approved">Stage 1</SelectItem>
              <SelectItem value="final_approved">Final approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          {canRaise && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="raise-expense-btn" className="bg-emerald-900 hover:bg-emerald-800"><Plus className="w-4 h-4 mr-1" /> Raise Expense</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Raise Expense</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                    <SelectTrigger data-testid="expense-project-select"><SelectValue placeholder="Project" /></SelectTrigger>
                    <SelectContent>
                      {projects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Category (e.g. Cement, Labor)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="expense-category-input" />
                  <Input type="number" placeholder="Amount ₹" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="expense-amount-input" />
                  <Input placeholder="Vendor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
                  <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  <label className="flex items-center gap-2 text-sm text-stone-600 border border-dashed border-stone-300 rounded-md p-3 cursor-pointer hover:bg-stone-50">
                    <Paperclip className="w-4 h-4" /> {file ? file.name : "Attach receipt (PDF/JPG/PNG)"}
                    <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".pdf,.jpg,.jpeg,.png" data-testid="receipt-input" />
                  </label>
                </div>
                <DialogFooter><Button onClick={raise} data-testid="submit-expense-btn" className="bg-emerald-900 hover:bg-emerald-800">Submit</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((e) => (
              <TableRow key={e.expense_id}>
                <TableCell className="text-stone-600">{e.created_at.slice(0, 10)}</TableCell>
                <TableCell>{projMap[e.project_id] || "—"}</TableCell>
                <TableCell className="font-medium">
                  {e.category}
                  <StatusFlow status={e.status} />
                  {e.rejection_reason && (
                    <div className="text-xs text-rose-700 mt-1">Reason: {e.rejection_reason}</div>
                  )}
                </TableCell>
                <TableCell className="text-stone-600">{e.vendor || "—"}</TableCell>
                <TableCell className="font-semibold">{fmt(e.amount)}</TableCell>
                <TableCell><StatusPill status={e.status} /></TableCell>
                <TableCell className="text-right space-x-2">
                  {e.receipt_file_id && (
                    <a href={`${process.env.REACT_APP_BACKEND_URL}/api/files/${e.receipt_file_id}/download?auth=${localStorage.getItem("session_token") || ""}`} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 hover:underline"><Paperclip className="inline w-3 h-3 mr-1" />Receipt</a>
                  )}
                  {canStage1 && e.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => approve(e, "stage1")} className="bg-emerald-900 hover:bg-emerald-800" data-testid={`approve-stage1-${e.expense_id}`}><Check className="w-3 h-3 mr-1" />Approve</Button>
                      <Button size="sm" variant="outline" className="text-rose-700" onClick={() => { setRejectFor(e); setRejectStage("stage1"); }}><X className="w-3 h-3 mr-1" />Reject</Button>
                    </>
                  )}
                  {canFinal && e.status === "stage1_approved" && (
                    <>
                      <Button size="sm" onClick={() => approve(e, "final")} className="bg-emerald-900 hover:bg-emerald-800" data-testid={`approve-final-${e.expense_id}`}><Check className="w-3 h-3 mr-1" />Final Approve</Button>
                      <Button size="sm" variant="outline" className="text-rose-700" onClick={() => { setRejectFor(e); setRejectStage("final"); }}><X className="w-3 h-3 mr-1" />Reject</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-stone-500">
                <Receipt className="w-6 h-6 mx-auto mb-2 text-stone-300" /> No expenses recorded
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject expense</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason for rejection" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} data-testid="reject-reason-input" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Cancel</Button>
            <Button data-testid="confirm-reject-btn" className="bg-rose-600 hover:bg-rose-700 text-white" onClick={doReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
