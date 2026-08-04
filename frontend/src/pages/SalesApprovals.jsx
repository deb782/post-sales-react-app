import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, RotateCcw, Handshake } from "lucide-react";
import { toast } from "sonner";

const fmt = (n = 0) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function SalesApprovals() {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [projects, setProjects] = useState([]);
  const [reviewFor, setReviewFor] = useState(null);
  const [action, setAction] = useState("approve");
  const [note, setNote] = useState("");

  const load = async () => {
    const [u, p] = await Promise.all([api.get("/units"), api.get("/projects")]);
    setPending(u.data.filter(x => x.status === "booked_pending_sales_approval"));
    setProjects(p.data);
  };
  useEffect(() => { load(); }, []);

  const projMap = Object.fromEntries(projects.map(p => [p.project_id, p.name]));

  const submit = async () => {
    try {
      await api.post(`/units/${reviewFor.unit_id}/sales-review`, { action, note });
      toast.success(`Booking ${action}ed`);
      setReviewFor(null); setNote(""); setAction("approve");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="sales-approvals-root">
      <div>
        <div className="text-xs uppercase tracking-widest text-stone-500">Approval queue</div>
        <h1 className="text-4xl font-bold text-stone-900 mt-1">Sales approvals</h1>
        <p className="mt-1 text-stone-500 text-sm">Review new bookings from your sales reps and confirm or return them.</p>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plot</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Total price</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.map(u => (
              <TableRow key={u.unit_id} data-testid={`approval-row-${u.plot_number}`}>
                <TableCell className="font-medium">{u.plot_number}</TableCell>
                <TableCell className="text-stone-600">{projMap[u.project_id] || "—"}</TableCell>
                <TableCell>
                  <div>{u.owner_name}</div>
                  <div className="text-xs text-stone-500">{u.owner_contact || u.owner_email || ""}</div>
                </TableCell>
                <TableCell>{fmt(u.total_price)}</TableCell>
                <TableCell>{u.discount ? fmt(u.discount) : "—"}</TableCell>
                <TableCell className="text-xs text-stone-500">{(u.sold_at || "").slice(0, 10)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="outline" onClick={() => { setReviewFor(u); setAction("return"); }} data-testid={`return-${u.plot_number}`}>
                      <RotateCcw className="w-3 h-3 mr-1" /> Return
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setReviewFor(u); setAction("reject"); }} className="text-rose-700" data-testid={`reject-${u.plot_number}`}>
                      <XCircle className="w-3 h-3 mr-1" /> Reject
                    </Button>
                    <Button size="sm" onClick={() => { setReviewFor(u); setAction("approve"); }} className="bg-emerald-900 hover:bg-emerald-800" data-testid={`approve-${u.plot_number}`}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {pending.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-stone-500">
                <Handshake className="w-6 h-6 mx-auto mb-2 text-stone-300" /> No bookings awaiting approval
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!reviewFor} onOpenChange={(o) => !o && setReviewFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{action === "approve" ? "Approve" : action === "reject" ? "Reject" : "Return for revision"} · Plot {reviewFor?.plot_number}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="text-stone-600">Owner: <b className="text-stone-900">{reviewFor?.owner_name}</b> · Price: <b className="text-stone-900">{fmt(reviewFor?.total_price || 0)}</b></div>
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-500">Note {action !== "approve" && <span className="text-rose-600">*</span>}</label>
              <Textarea rows={3} className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder={action === "approve" ? "Optional note" : "Reason for reject / return"} data-testid="review-note-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewFor(null)}>Cancel</Button>
            <Button className="bg-emerald-900 hover:bg-emerald-800" onClick={submit} disabled={action !== "approve" && !note.trim()} data-testid="submit-review-btn">
              Confirm {action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
