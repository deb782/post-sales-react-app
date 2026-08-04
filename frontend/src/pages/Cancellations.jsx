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
import { Ban, CheckCircle2, XCircle, Banknote } from "lucide-react";
import { toast } from "sonner";

const fmt = (n = 0) => "₹" + Math.round(n).toLocaleString("en-IN");

const STATUS_STYLE = {
  pending_sales_review: "bg-amber-50 border-amber-200 text-amber-800",
  pending_refund: "bg-sky-50 border-sky-200 text-sky-800",
  refund_completed: "bg-emerald-50 border-emerald-200 text-emerald-800",
  rejected: "bg-rose-50 border-rose-200 text-rose-800",
};
const STATUS_LABEL = {
  pending_sales_review: "Sales Head review",
  pending_refund: "Refund pending",
  refund_completed: "Refund completed",
  rejected: "Rejected",
};

export default function Cancellations() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [units, setUnits] = useState({});
  const [projects, setProjects] = useState({});
  const [reviewFor, setReviewFor] = useState(null);
  const [reviewAction, setReviewAction] = useState("approve");
  const [reviewNote, setReviewNote] = useState("");
  const [refundFor, setRefundFor] = useState(null);
  const [refund, setRefund] = useState({ refund_reference: "", refund_mode: "bank_transfer", refund_notes: "" });

  const canSalesReview = ["super_admin", "sales_head"].includes(user.role);
  const canRecordRefund = ["super_admin", "accounts_head", "accounts_rep"].includes(user.role);

  const load = async () => {
    const [c, u, p] = await Promise.all([
      api.get("/cancellations"),
      api.get("/units"),
      api.get("/projects"),
    ]);
    setRows(c.data);
    setUnits(Object.fromEntries(u.data.map((x) => [x.unit_id, x])));
    setProjects(Object.fromEntries(p.data.map((x) => [x.project_id, x.name])));
  };
  useEffect(() => { load(); }, []);

  const buckets = useMemo(() => ({
    pending_sales_review: rows.filter(r => r.status === "pending_sales_review"),
    pending_refund: rows.filter(r => r.status === "pending_refund"),
    refund_completed: rows.filter(r => r.status === "refund_completed"),
    rejected: rows.filter(r => r.status === "rejected"),
  }), [rows]);

  const submitReview = async () => {
    if (reviewAction !== "approve" && !reviewNote.trim()) {
      return toast.error("Please provide a reason");
    }
    try {
      await api.post(`/cancellations/${reviewFor.cancellation_id}/sales-review`, {
        action: reviewAction, note: reviewNote,
      });
      toast.success(`Cancellation ${reviewAction === "approve" ? "approved" : "rejected"}`);
      setReviewFor(null); setReviewAction("approve"); setReviewNote("");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const submitRefund = async () => {
    try {
      await api.post(`/cancellations/${refundFor.cancellation_id}/refund`, refund);
      toast.success("Refund recorded — unit released for resale");
      setRefundFor(null);
      setRefund({ refund_reference: "", refund_mode: "bank_transfer", refund_notes: "" });
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="cancellations-root">
      <div>
        <div className="text-xs uppercase tracking-widest text-stone-500">Post-sales</div>
        <h1 className="text-4xl font-bold text-stone-900 mt-1">Booking cancellations</h1>
        <p className="mt-1 text-stone-500 text-sm">Review cancellation requests, process refunds, and release plots back to inventory.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Sales review" value={buckets.pending_sales_review.length} tone="amber" />
        <Tile label="Refund pending" value={buckets.pending_refund.length} tone="sky" />
        <Tile label="Completed" value={buckets.refund_completed.length} tone="emerald" />
        <Tile label="Rejected" value={buckets.rejected.length} tone="rose" />
      </div>

      <Section title="Active cancellations">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plot</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Refund</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.filter(r => r.status !== "refund_completed" && r.status !== "rejected").map(r => {
              const u = units[r.unit_id] || {};
              return (
                <TableRow key={r.cancellation_id} data-testid={`cxl-row-${r.cancellation_id}`}>
                  <TableCell className="font-medium">{u.plot_number || r.unit_id}</TableCell>
                  <TableCell className="text-stone-600">{projects[r.project_id] || "—"}</TableCell>
                  <TableCell>
                    <div>{u.owner_name || "—"}</div>
                    <div className="text-xs text-stone-500">{u.owner_contact || u.owner_email || ""}</div>
                  </TableCell>
                  <TableCell>{fmt(r.refund_amount)}</TableCell>
                  <TableCell className="text-xs text-stone-500">{(r.initiated_at || "").slice(0, 10)}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status] || ""}`}>{STATUS_LABEL[r.status] || r.status}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending_sales_review" && canSalesReview && (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" className="text-rose-700" onClick={() => { setReviewFor(r); setReviewAction("reject"); }} data-testid={`cxl-reject-${r.cancellation_id}`}>
                          <XCircle className="w-3 h-3 mr-1" /> Reject
                        </Button>
                        <Button size="sm" className="bg-emerald-900 hover:bg-emerald-800" onClick={() => { setReviewFor(r); setReviewAction("approve"); }} data-testid={`cxl-approve-${r.cancellation_id}`}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                        </Button>
                      </div>
                    )}
                    {r.status === "pending_refund" && canRecordRefund && (
                      <Button size="sm" className="bg-emerald-900 hover:bg-emerald-800" onClick={() => setRefundFor(r)} data-testid={`cxl-refund-${r.cancellation_id}`}>
                        <Banknote className="w-3 h-3 mr-1" /> Record refund
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.filter(r => r.status !== "refund_completed" && r.status !== "rejected").length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-stone-500">
                <Ban className="w-6 h-6 mx-auto mb-2 text-stone-300" /> No active cancellations
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Section>

      {(buckets.refund_completed.length > 0 || buckets.rejected.length > 0) && (
        <Section title="History">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plot</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Refund</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.filter(r => r.status === "refund_completed" || r.status === "rejected").map(r => {
                const u = units[r.unit_id] || {};
                return (
                  <TableRow key={r.cancellation_id}>
                    <TableCell className="font-medium">{u.plot_number || r.unit_id}</TableCell>
                    <TableCell className="text-stone-600">{projects[r.project_id] || "—"}</TableCell>
                    <TableCell>{u.owner_name || r.reason?.slice(0, 30) || "—"}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status] || ""}`}>{STATUS_LABEL[r.status] || r.status}</span>
                    </TableCell>
                    <TableCell className="text-xs text-stone-500 max-w-xs truncate">{r.reason}</TableCell>
                    <TableCell>{r.status === "refund_completed" ? fmt(r.refund_amount) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Section>
      )}

      {/* Sales review dialog */}
      <Dialog open={!!reviewFor} onOpenChange={(o) => !o && setReviewFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "Approve cancellation" : "Reject cancellation"} · Plot {units[reviewFor?.unit_id]?.plot_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="text-stone-600">
              Reason: <span className="text-stone-900">{reviewFor?.reason}</span>
            </div>
            <div className="text-stone-600">
              Refund amount: <b className="text-stone-900">{fmt(reviewFor?.refund_amount || 0)}</b>
              {reviewFor?.refund_amount === 0 && <span className="ml-2 text-emerald-700 text-xs">No payments received yet — plot will be released immediately</span>}
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-500">Note {reviewAction === "reject" && <span className="text-rose-600">*</span>}</label>
              <Textarea rows={3} className="mt-1" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder={reviewAction === "approve" ? "Optional note" : "Reason for rejection"} data-testid="cxl-review-note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewFor(null)}>Cancel</Button>
            <Button className="bg-emerald-900 hover:bg-emerald-800" onClick={submitReview} disabled={reviewAction === "reject" && !reviewNote.trim()} data-testid="cxl-review-submit">
              Confirm {reviewAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund dialog */}
      <Dialog open={!!refundFor} onOpenChange={(o) => !o && setRefundFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record refund · Plot {units[refundFor?.unit_id]?.plot_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
              Refund amount: <b>{fmt(refundFor?.refund_amount || 0)}</b>
              <div className="text-xs text-emerald-700 mt-0.5">Full amount received to date — no deductions.</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-500">Mode</label>
                <Select value={refund.refund_mode} onValueChange={(v) => setRefund({ ...refund, refund_mode: v })}>
                  <SelectTrigger className="mt-1" data-testid="refund-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-500">Reference #</label>
                <Input value={refund.refund_reference} onChange={(e) => setRefund({ ...refund, refund_reference: e.target.value })} className="mt-1" data-testid="refund-reference" />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-500">Notes</label>
              <Textarea rows={2} className="mt-1" value={refund.refund_notes} onChange={(e) => setRefund({ ...refund, refund_notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundFor(null)}>Cancel</Button>
            <Button className="bg-emerald-900 hover:bg-emerald-800" onClick={submitRefund} data-testid="refund-submit">Complete refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl">
      <div className="p-4 border-b border-stone-200 text-sm font-semibold text-stone-900">{title}</div>
      {children}
    </div>
  );
}

function Tile({ label, value, tone }) {
  const cls = tone === "emerald" ? "bg-emerald-50 border-emerald-200 text-emerald-900"
    : tone === "amber" ? "bg-amber-50 border-amber-200 text-amber-900"
    : tone === "sky" ? "bg-sky-50 border-sky-200 text-sky-900"
    : tone === "rose" ? "bg-rose-50 border-rose-200 text-rose-900"
    : "bg-white border-stone-200 text-stone-900";
  return (
    <div className={`p-4 rounded-xl border ${cls}`}>
      <div className="text-[11px] uppercase tracking-widest text-stone-500">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}
