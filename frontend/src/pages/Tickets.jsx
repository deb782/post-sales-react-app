import { useEffect, useMemo, useState } from "react";
import { api, apiError } from "@/lib/api";
import { useAuth, can } from "@/lib/auth";
import { useProjectFilter } from "@/components/ProjectFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, TicketCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const SEV_META = {
  low: "bg-stone-100 text-stone-700 border-stone-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  critical: "bg-rose-100 text-rose-800 border-rose-200",
};
const STATUS_META = {
  open: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-amber-100 text-amber-800 border-amber-200",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  closed: "bg-stone-100 text-stone-700 border-stone-200",
};

const BLANK = { project_id: "", stock_item_id: "", subject: "", description: "", severity: "medium" };

export default function Tickets() {
  const { user } = useAuth();
  const { projects } = useProjectFilter();
  const [tickets, setTickets] = useState([]);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [resolveFor, setResolveFor] = useState(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("resolved");

  const load = async () => {
    const [t, s] = await Promise.all([
      api.get("/tickets"),
      api.get("/stock/items").catch(() => ({ data: [] })),
    ]);
    setTickets(t.data);
    setItems(s.data);
  };
  useEffect(() => { load(); }, []);

  const projMap = useMemo(() => Object.fromEntries(projects.map(p => [p.project_id, p.name])), [projects]);
  const itemMap = useMemo(() => Object.fromEntries(items.map(i => [i.item_id, i.name])), [items]);

  const create = async () => {
    if (!form.subject || !form.project_id) return toast.error("Project and subject required");
    try {
      await api.post("/tickets", {
        ...form,
        stock_item_id: form.stock_item_id || null,
      });
      toast.success("Ticket raised");
      setOpen(false); setForm(BLANK);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const doResolve = async () => {
    try {
      await api.patch(`/tickets/${resolveFor.ticket_id}`, { status, resolution_note: note });
      toast.success("Ticket updated");
      setResolveFor(null); setNote(""); setStatus("resolved");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const canResolve = can(user, "admin", "management");
  const canCreate = can(user, "super_admin", "process_admin", "crm_head", "site_supervisor");

  const scopedProjects = user.role === "site_supervisor"
    ? projects.filter(p => (user.project_ids || []).includes(p.project_id))
    : projects;

  return (
    <div className="space-y-6" data-testid="tickets-root">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500">Inventory disputes</div>
          <h1 className="text-4xl font-bold text-stone-900 mt-1">Tickets</h1>
          <p className="mt-1 text-stone-500 text-sm">Site Managers raise disputes on stock. Admin / Management resolve them.</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-900 hover:bg-emerald-800" data-testid="new-ticket-btn"><Plus className="w-4 h-4 mr-1" /> New ticket</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Raise inventory ticket</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-500">Project *</label>
                  <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                    <SelectTrigger className="mt-1" data-testid="ticket-project-select"><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent>{scopedProjects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-500">Related stock item (optional)</label>
                  <Select value={form.stock_item_id || "__none__"} onValueChange={(v) => setForm({ ...form, stock_item_id: v === "__none__" ? "" : v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {items.filter(i => !form.project_id || i.project_id === form.project_id).map(i => <SelectItem key={i.item_id} value={i.item_id}>{i.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-500">Severity</label>
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-500">Subject *</label>
                  <Input className="mt-1" placeholder="Cement bags missing on Block A" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} data-testid="ticket-subject" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-500">Description</label>
                  <Textarea rows={4} className="mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What happened, expected vs actual, and any photos or references" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={create} className="bg-emerald-900 hover:bg-emerald-800" data-testid="submit-ticket-btn">Submit</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="bg-white border border-stone-200 rounded-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map(t => (
              <TableRow key={t.ticket_id} data-testid={`ticket-row-${t.ticket_id}`}>
                <TableCell className="font-medium">
                  <div>{t.subject}</div>
                  {t.description && <div className="text-xs text-stone-500 mt-0.5 line-clamp-1">{t.description}</div>}
                </TableCell>
                <TableCell className="text-stone-600">{projMap[t.project_id] || "—"}</TableCell>
                <TableCell className="text-stone-600">{itemMap[t.stock_item_id] || "—"}</TableCell>
                <TableCell><span className={`text-xs px-2 py-0.5 rounded-full border ${SEV_META[t.severity]}`}>{t.severity}</span></TableCell>
                <TableCell><span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_META[t.status]}`}>{t.status.replace("_"," ")}</span></TableCell>
                <TableCell className="text-xs text-stone-500">{t.created_at.slice(0, 10)}</TableCell>
                <TableCell className="text-right">
                  {canResolve && ["open", "in_progress"].includes(t.status) && (
                    <Button size="sm" variant="outline" onClick={() => { setResolveFor(t); setNote(""); setStatus("resolved"); }} data-testid={`resolve-btn-${t.ticket_id}`}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Resolve
                    </Button>
                  )}
                  {t.status === "resolved" && <span className="text-xs text-emerald-800">Resolved</span>}
                </TableCell>
              </TableRow>
            ))}
            {tickets.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-stone-500">
                <TicketCheck className="w-6 h-6 mx-auto mb-2 text-stone-300" /> No tickets yet
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!resolveFor} onOpenChange={(o) => !o && setResolveFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resolve · {resolveFor?.subject}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-500">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-500">Resolution note</label>
              <Textarea rows={4} className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="How was this addressed?" data-testid="resolution-note" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={doResolve} className="bg-emerald-900 hover:bg-emerald-800" data-testid="confirm-resolve-btn">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
