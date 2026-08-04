import { useEffect, useMemo, useState } from "react";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Package, Plus, Trash2, CheckCircle2, XCircle, RotateCcw, HardHat } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLE = {
  pending_crm_review: "bg-amber-50 border-amber-200 text-amber-800",
  pending_admin_review: "bg-sky-50 border-sky-200 text-sky-800",
  pending_super_admin: "bg-indigo-50 border-indigo-200 text-indigo-800",
  approved: "bg-emerald-50 border-emerald-200 text-emerald-900",
  rejected: "bg-rose-50 border-rose-200 text-rose-800",
};
const STATUS_LABEL = {
  pending_crm_review: "CRM review",
  pending_admin_review: "Process Admin review",
  pending_super_admin: "Super Admin approval",
  approved: "Approved",
  rejected: "Rejected",
};

const PRIORITY_STYLE = {
  low: "bg-stone-50 border-stone-200 text-stone-700",
  medium: "bg-sky-50 border-sky-200 text-sky-800",
  high: "bg-amber-50 border-amber-200 text-amber-800",
  urgent: "bg-rose-50 border-rose-200 text-rose-800",
};

export default function MaterialRequests() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [projects, setProjects] = useState([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({ project_id: "", subject: "", priority: "medium", justification: "", items: [{ name: "", quantity: 1, unit: "pcs", notes: "" }] });
  const [reviewFor, setReviewFor] = useState(null);
  const [reviewStage, setReviewStage] = useState(""); // 'crm' | 'admin' | 'final'
  const [reviewAction, setReviewAction] = useState("approve");
  const [reviewNote, setReviewNote] = useState("");
  const [viewFor, setViewFor] = useState(null);

  const projMap = useMemo(() => Object.fromEntries(projects.map(p => [p.project_id, p.name])), [projects]);

  const load = async () => {
    const [m, p] = await Promise.all([api.get("/material-requests"), api.get("/projects")]);
    setRows(m.data);
    setProjects(p.data);
  };
  useEffect(() => { load(); }, []);

  const canCreate = ["super_admin", "process_admin", "crm_head", "site_supervisor"].includes(user.role);
  const canCrmReview = ["super_admin", "crm_head"].includes(user.role);
  const canAdminReview = ["super_admin", "process_admin"].includes(user.role);
  const canFinal = user.role === "super_admin";

  const buckets = useMemo(() => ({
    pending_crm_review: rows.filter(r => r.status === "pending_crm_review"),
    pending_admin_review: rows.filter(r => r.status === "pending_admin_review"),
    pending_super_admin: rows.filter(r => r.status === "pending_super_admin"),
    approved: rows.filter(r => r.status === "approved"),
    rejected: rows.filter(r => r.status === "rejected"),
  }), [rows]);

  const activeRows = rows.filter(r => !["approved", "rejected"].includes(r.status));

  const openReview = (r) => {
    setReviewFor(r);
    setReviewNote("");
    setReviewAction("approve");
    if (r.status === "pending_crm_review") setReviewStage("crm");
    else if (r.status === "pending_admin_review") setReviewStage("admin");
    else if (r.status === "pending_super_admin") setReviewStage("final");
  };

  const submitReview = async () => {
    if (reviewAction !== "approve" && !reviewNote.trim()) {
      return toast.error("Please provide a note");
    }
    const url = reviewStage === "crm"
      ? `/material-requests/${reviewFor.request_id}/crm-review`
      : reviewStage === "admin"
        ? `/material-requests/${reviewFor.request_id}/admin-review`
        : `/material-requests/${reviewFor.request_id}/final`;
    try {
      await api.post(url, { action: reviewAction, note: reviewNote });
      toast.success(`Request ${reviewAction}${reviewAction.endsWith("e") ? "d" : "ed"}`);
      setReviewFor(null);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { name: "", quantity: 1, unit: "pcs", notes: "" }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updItem = (i, patch) => setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) }));

  const submitCreate = async () => {
    if (!form.project_id) return toast.error("Pick a project");
    if (!form.subject.trim()) return toast.error("Enter a subject");
    const validItems = form.items.filter(i => i.name.trim() && Number(i.quantity) > 0);
    if (!validItems.length) return toast.error("Add at least one item");
    try {
      await api.post("/material-requests", {
        ...form,
        items: validItems.map(i => ({ ...i, quantity: Number(i.quantity) })),
      });
      toast.success("Material request submitted for CRM review");
      setOpenCreate(false);
      setForm({ project_id: "", subject: "", priority: "medium", justification: "", items: [{ name: "", quantity: 1, unit: "pcs", notes: "" }] });
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const canReviewRow = (r) => {
    if (r.status === "pending_crm_review") return canCrmReview;
    if (r.status === "pending_admin_review") return canAdminReview;
    if (r.status === "pending_super_admin") return canFinal;
    return false;
  };

  return (
    <div className="space-y-6" data-testid="material-requests-root">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500">Site operations</div>
          <h1 className="text-4xl font-bold text-stone-900 mt-1">Material requests</h1>
          <p className="mt-1 text-stone-500 text-sm">Site supervisors raise requests → CRM Head reviews → Process Admin reviews → Super Admin approves.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setOpenCreate(true)} className="bg-emerald-900 hover:bg-emerald-800" data-testid="new-mr-btn">
            <Plus className="w-4 h-4 mr-1" /> New request
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Tile label="CRM review" value={buckets.pending_crm_review.length} tone="amber" />
        <Tile label="Admin review" value={buckets.pending_admin_review.length} tone="sky" />
        <Tile label="Super Admin" value={buckets.pending_super_admin.length} tone="indigo" />
        <Tile label="Approved" value={buckets.approved.length} tone="emerald" />
        <Tile label="Rejected" value={buckets.rejected.length} tone="rose" />
      </div>

      <div className="bg-white border border-stone-200 rounded-xl">
        <div className="p-4 border-b border-stone-200 text-sm font-semibold text-stone-900">Active queue</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeRows.map(r => (
              <TableRow key={r.request_id} data-testid={`mr-row-${r.request_id}`}>
                <TableCell className="font-medium">
                  <button className="hover:underline text-left" onClick={() => setViewFor(r)}>{r.subject}</button>
                </TableCell>
                <TableCell className="text-stone-600">{projMap[r.project_id] || "—"}</TableCell>
                <TableCell className="text-xs text-stone-500">{r.items.length} item{r.items.length !== 1 ? "s" : ""}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${PRIORITY_STYLE[r.priority] || ""}`}>{r.priority}</span>
                </TableCell>
                <TableCell className="text-xs text-stone-500">{(r.requested_at || "").slice(0, 10)}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status] || ""}`}>{STATUS_LABEL[r.status] || r.status}</span>
                </TableCell>
                <TableCell className="text-right">
                  {canReviewRow(r) ? (
                    <div className="flex gap-1 justify-end">
                      {(r.status !== "pending_super_admin") && (
                        <Button size="sm" variant="outline" onClick={() => { openReview(r); setReviewAction("return"); }} data-testid={`mr-return-${r.request_id}`}>
                          <RotateCcw className="w-3 h-3 mr-1" /> Return
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="text-rose-700" onClick={() => { openReview(r); setReviewAction("reject"); }} data-testid={`mr-reject-${r.request_id}`}>
                        <XCircle className="w-3 h-3 mr-1" /> Reject
                      </Button>
                      <Button size="sm" className="bg-emerald-900 hover:bg-emerald-800" onClick={() => { openReview(r); setReviewAction("approve"); }} data-testid={`mr-approve-${r.request_id}`}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setViewFor(r)}>View</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {activeRows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-stone-500">
                <HardHat className="w-6 h-6 mx-auto mb-2 text-stone-300" /> No pending material requests
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {(buckets.approved.length > 0 || buckets.rejected.length > 0) && (
        <div className="bg-white border border-stone-200 rounded-xl">
          <div className="p-4 border-b border-stone-200 text-sm font-semibold text-stone-900">History</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Closed on</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...buckets.approved, ...buckets.rejected].map(r => (
                <TableRow key={r.request_id}>
                  <TableCell className="font-medium">
                    <button className="hover:underline text-left" onClick={() => setViewFor(r)}>{r.subject}</button>
                  </TableCell>
                  <TableCell className="text-stone-600">{projMap[r.project_id] || "—"}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full border ${PRIORITY_STYLE[r.priority] || ""}`}>{r.priority}</span></TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status] || ""}`}>{STATUS_LABEL[r.status] || r.status}</span></TableCell>
                  <TableCell className="text-xs text-stone-500">{(r.final_at || r.admin_reviewed_at || r.crm_reviewed_at || "").slice(0, 10)}</TableCell>
                  <TableCell className="text-xs text-stone-500 max-w-xs truncate">{r.final_note || r.rejection_reason || r.crm_note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New material request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-500">Project *</label>
                <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                  <SelectTrigger className="mt-1" data-testid="mr-project-select"><SelectValue placeholder="Pick a project" /></SelectTrigger>
                  <SelectContent>
                    {projects.filter(p => user.role !== "site_supervisor" || (user.project_ids || []).includes(p.project_id)).map(p => (
                      <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-500">Priority</label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-500">Subject *</label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="mt-1" placeholder="e.g. Cement + steel for phase 2 foundation" data-testid="mr-subject" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-500">Justification</label>
              <Textarea rows={2} value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} className="mt-1" placeholder="Why is this needed?" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs uppercase tracking-widest text-stone-500">Items *</label>
                <Button size="sm" variant="ghost" onClick={addItem} data-testid="mr-add-item"><Plus className="w-3 h-3 mr-1" /> Add row</Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {form.items.map((it, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-5" placeholder="Material name" value={it.name} onChange={(e) => updItem(i, { name: e.target.value })} data-testid={`mr-item-name-${i}`} />
                    <Input className="col-span-2" type="number" min="0" placeholder="Qty" value={it.quantity} onChange={(e) => updItem(i, { quantity: e.target.value })} data-testid={`mr-item-qty-${i}`} />
                    <Input className="col-span-2" placeholder="Unit" value={it.unit} onChange={(e) => updItem(i, { unit: e.target.value })} />
                    <Input className="col-span-2" placeholder="Notes" value={it.notes} onChange={(e) => updItem(i, { notes: e.target.value })} />
                    <Button size="sm" variant="ghost" className="col-span-1 text-rose-600" onClick={() => removeItem(i)} disabled={form.items.length === 1}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button onClick={submitCreate} className="bg-emerald-900 hover:bg-emerald-800" data-testid="mr-submit-btn">Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <Dialog open={!!reviewFor} onOpenChange={(o) => !o && setReviewFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "Approve" : reviewAction === "reject" ? "Reject" : "Return"} — {reviewFor?.subject}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="text-stone-600">
              {reviewFor?.items?.map((i, idx) => (
                <div key={idx} className="text-xs">• {i.name} — {i.quantity} {i.unit}{i.notes ? ` (${i.notes})` : ""}</div>
              ))}
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-500">Note {reviewAction !== "approve" && <span className="text-rose-600">*</span>}</label>
              <Textarea rows={3} className="mt-1" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} data-testid="mr-review-note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewFor(null)}>Cancel</Button>
            <Button className="bg-emerald-900 hover:bg-emerald-800" onClick={submitReview} disabled={reviewAction !== "approve" && !reviewNote.trim()} data-testid="mr-review-submit">Confirm {reviewAction}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog (read-only for people who can't act) */}
      <Dialog open={!!viewFor} onOpenChange={(o) => !o && setViewFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-stone-500" />{viewFor?.subject}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="text-stone-600">Project · <b className="text-stone-900">{projMap[viewFor?.project_id]}</b></div>
            <div className="text-stone-600">Priority · <b className="text-stone-900">{viewFor?.priority}</b></div>
            <div className="text-stone-600">Status · <b className="text-stone-900">{STATUS_LABEL[viewFor?.status]}</b></div>
            {viewFor?.justification && <div className="text-stone-600">Justification · <span className="text-stone-900">{viewFor.justification}</span></div>}
            <div>
              <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">Items</div>
              <div className="rounded-md border border-stone-200 divide-y">
                {viewFor?.items?.map((i, idx) => (
                  <div key={idx} className="p-2 flex justify-between text-sm">
                    <div>{i.name}{i.notes ? <span className="text-xs text-stone-500 ml-2">({i.notes})</span> : ""}</div>
                    <div className="text-stone-600">{i.quantity} {i.unit}</div>
                  </div>
                ))}
              </div>
            </div>
            {viewFor?.crm_note && <div className="text-xs text-stone-600"><b>CRM note:</b> {viewFor.crm_note}</div>}
            {viewFor?.admin_note && <div className="text-xs text-stone-600"><b>Admin note:</b> {viewFor.admin_note}</div>}
            {viewFor?.final_note && <div className="text-xs text-stone-600"><b>Final note:</b> {viewFor.final_note}</div>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Tile({ label, value, tone }) {
  const cls = tone === "emerald" ? "bg-emerald-50 border-emerald-200 text-emerald-900"
    : tone === "amber" ? "bg-amber-50 border-amber-200 text-amber-900"
    : tone === "sky" ? "bg-sky-50 border-sky-200 text-sky-900"
    : tone === "indigo" ? "bg-indigo-50 border-indigo-200 text-indigo-900"
    : tone === "rose" ? "bg-rose-50 border-rose-200 text-rose-900"
    : "bg-white border-stone-200 text-stone-900";
  return (
    <div className={`p-4 rounded-xl border ${cls}`}>
      <div className="text-[11px] uppercase tracking-widest text-stone-500">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}
