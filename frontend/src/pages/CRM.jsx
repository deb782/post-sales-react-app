import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { useAuth, can } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Clock, ChevronRight, ArrowLeft, User, IndianRupee, Calendar, Plus, X } from "lucide-react";

const fmt = (n = 0) => "₹" + Math.round(n).toLocaleString("en-IN");
const dateOnly = (iso) => (iso || "").slice(0, 10);

const STATUS_META = {
  booked_pending_sales_approval: { label: "Pending Sales Approval", tone: "bg-orange-100 text-orange-800 border-orange-200" },
  sale_confirmed: { label: "Sale Confirmed", tone: "bg-amber-100 text-amber-800 border-amber-200" },
  post_sales_active: { label: "Post-Sales Active", tone: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  fully_paid: { label: "Fully Paid", tone: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  registration_pending: { label: "Registration Pending", tone: "bg-blue-100 text-blue-800 border-blue-200" },
  registered: { label: "Registered", tone: "bg-teal-100 text-teal-800 border-teal-200" },
  possession_pending: { label: "Possession Pending", tone: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  possession_completed: { label: "Possession Done", tone: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

const INST_META = {
  upcoming: { label: "Upcoming", tone: "bg-stone-100 text-stone-700" },
  due_soon: { label: "Due Soon", tone: "bg-amber-100 text-amber-800" },
  due_today: { label: "Due Today", tone: "bg-orange-100 text-orange-800" },
  overdue: { label: "Overdue", tone: "bg-rose-100 text-rose-800" },
  promise_to_pay: { label: "Promise to Pay", tone: "bg-indigo-100 text-indigo-800" },
  payment_claimed: { label: "Claimed — Verifying", tone: "bg-blue-100 text-blue-800" },
  not_reflected: { label: "Not Reflected", tone: "bg-rose-100 text-rose-800" },
  pending_head_approval: { label: "Pending Head Approval", tone: "bg-yellow-100 text-yellow-800" },
  partial: { label: "Partial Received", tone: "bg-emerald-100 text-emerald-800" },
  paid: { label: "Paid", tone: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejected", tone: "bg-rose-100 text-rose-800" },
  waived: { label: "Waived", tone: "bg-stone-100 text-stone-700" },
  rescheduled: { label: "Rescheduled", tone: "bg-slate-100 text-slate-800" },
};

export default function CRM() {
  const { unitId } = useParams();
  const nav = useNavigate();
  const [units, setUnits] = useState([]);
  const [projects, setProjects] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [installments, setInstallments] = useState([]);

  const load = useCallback(async () => {
    const [u, p, t] = await Promise.all([
      api.get("/units"),
      api.get("/projects"),
      api.get("/payment-templates"),
    ]);
    setUnits(u.data);
    setProjects(p.data);
    setTemplates(t.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const projMap = useMemo(() => Object.fromEntries(projects.map(p => [p.project_id, p])), [projects]);

  const pipeline = units.filter(u => ["booked_pending_sales_approval","sale_confirmed","post_sales_active","fully_paid","registration_pending","registered","possession_pending","possession_completed"].includes(u.status));

  useEffect(() => {
    if (unitId) {
      const u = units.find(x => x.unit_id === unitId);
      if (u) setSelected(u);
    } else {
      setSelected(null);
    }
  }, [unitId, units]);

  useEffect(() => {
    if (selected) api.get(`/units/${selected.unit_id}/installments`).then(r => setInstallments(r.data));
    else setInstallments([]);
  }, [selected]);

  if (!selected) {
    return (
      <div className="space-y-6" data-testid="crm-root">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500">CRM</div>
          <h1 className="text-4xl font-bold text-stone-900 mt-1">Buyer accounts</h1>
          <p className="mt-1 text-stone-500 text-sm">Every plot the Sales team has booked. Click a row to schedule payments and track collection.</p>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plot</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Total price</TableHead>
                <TableHead>Sold on</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pipeline.map(u => {
                const meta = STATUS_META[u.status] || {};
                return (
                  <TableRow key={u.unit_id} className="cursor-pointer hover:bg-stone-50" onClick={() => nav(`/crm/${u.unit_id}`)} data-testid={`crm-row-${u.plot_number}`}>
                    <TableCell className="font-medium">{u.plot_number}</TableCell>
                    <TableCell className="text-stone-600">{projMap[u.project_id]?.name || "—"}</TableCell>
                    <TableCell>{u.owner_name}</TableCell>
                    <TableCell>{fmt(u.total_price || 0)}</TableCell>
                    <TableCell className="text-stone-600">{dateOnly(u.sold_at)}</TableCell>
                    <TableCell><span className={`text-xs px-2 py-0.5 rounded-full border ${meta.tone}`}>{meta.label}</span></TableCell>
                    <TableCell className="text-right"><ChevronRight className="w-4 h-4 text-stone-400 inline-block" /></TableCell>
                  </TableRow>
                );
              })}
              {pipeline.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-stone-500">No sold plots yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <UnitDetail
      unit={selected}
      project={projMap[selected.project_id]}
      templates={templates}
      installments={installments}
      reload={async () => { await load(); const r = await api.get(`/units/${selected.unit_id}/installments`); setInstallments(r.data); }}
      onBack={() => nav("/crm")}
    />
  );
}

function UnitDetail({ unit, project, templates, installments, reload, onBack }) {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState([]);
  const [tplId, setTplId] = useState(unit.payment_plan_template_id || "");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => setSchedule(installments || []), [installments]);

  const totalScheduled = schedule.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalReceived = installments.filter(i => ["paid","partial"].includes(i.status)).reduce((s, i) => s + (i.received_amount || i.amount), 0);

  const applyTemplate = () => {
    const tpl = templates.find(t => t.template_id === tplId);
    if (!tpl) return toast.error("Pick a template");
    const start = new Date(startDate);
    const rows = tpl.stages.map(s => {
      const d = new Date(start); d.setDate(d.getDate() + Number(s.days_from_start || 0));
      return {
        stage_name: s.name,
        percent: s.percent,
        amount: Math.round((unit.total_price || 0) * s.percent / 100),
        due_date: d.toISOString().slice(0, 10),
        notes: "",
      };
    });
    setSchedule(rows);
  };

  const addRow = () => setSchedule(s => [...s, { stage_name: "", percent: 0, amount: 0, due_date: startDate, notes: "" }]);
  const upd = (i, k, v) => setSchedule(s => { const n = [...s]; n[i] = { ...n[i], [k]: v }; return n; });
  const rm = (i) => setSchedule(s => s.filter((_, x) => x !== i));

  const saveSchedule = async () => {
    try {
      await api.post(`/units/${unit.unit_id}/installments`, schedule.map(r => ({
        stage_name: r.stage_name,
        percent: Number(r.percent) || 0,
        amount: Number(r.amount) || 0,
        due_date: r.due_date,
        notes: r.notes || "",
      })));
      toast.success("Schedule saved · Admin & Accounts notified");
      reload();
    } catch (e) { toast.error(apiError(e)); }
  };

  const claim = async (id) => {
    const amt = window.prompt("Claimed amount ₹");
    if (!amt) return;
    const ref = window.prompt("Reference (UTR / cheque no)") || "";
    try { await api.post(`/installments/${id}/claim`, { claimed_amount: Number(amt), claim_reference: ref, claim_mode: "bank_transfer" }); toast.success("Claimed — Accounts will verify"); reload(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const verify = async (id, reflected) => {
    const amt = reflected ? window.prompt("Amount reflected in bank ₹") : "0";
    if (reflected && !amt) return;
    try { await api.post(`/installments/${id}/verify`, { reflected, received_amount: Number(amt || 0) }); toast.success(reflected ? "Verified · awaiting Head approval" : "Marked not reflected"); reload(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const approve = async (id, action) => {
    try { await api.post(`/installments/${id}/approve`, { action, note: "" }); toast.success(action === "approve" ? "Payment approved" : "Payment rejected"); reload(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const canSchedule = can(user, "super_admin", "process_admin", "crm_head");
  const isCRM = can(user, "super_admin", "crm_head", "post_sales_rep", "process_admin");
  const isAcctRep = can(user, "super_admin", "accounts_head", "accounts_rep");
  const isAcctHead = can(user, "super_admin", "accounts_head");
  const readOnly = installments.length > 0;

  return (
    <div className="space-y-6" data-testid="crm-detail-root">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-2"><ArrowLeft className="w-4 h-4 mr-1" /> All buyer accounts</Button>
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <div className="text-xs uppercase tracking-widest text-stone-500">{project?.name || "Project"}</div>
            <h1 className="text-3xl font-bold text-stone-900 mt-1">Plot {unit.plot_number}</h1>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_META[unit.status]?.tone}`}>{STATUS_META[unit.status]?.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoCard icon={User} label="Owner" primary={unit.owner_name || "—"} sub={unit.owner_contact || unit.owner_email || ""} />
        <InfoCard icon={IndianRupee} label="Total price" primary={fmt(unit.total_price || 0)} sub={unit.discount ? `Discount ${fmt(unit.discount)}` : "No discount"} />
        <InfoCard icon={Calendar} label="Sold on" primary={dateOnly(unit.sold_at)} sub={`Size: ${unit.size || "—"} · Facing: ${unit.facing || "—"}`} />
      </div>

      {installments.length === 0 && canSchedule && (
        <div className="bg-white border border-stone-200 rounded-xl p-6" data-testid="crm-build-schedule">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-stone-500">Step 1</div>
              <h2 className="text-xl font-bold text-stone-900 mt-0.5">Build payment schedule</h2>
              <p className="text-sm text-stone-500 mt-1">Apply a template or add rows manually. Buyer will be tracked against these installments.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="md:col-span-2">
              <label className="text-xs uppercase tracking-widest text-stone-500">Template</label>
              <Select value={tplId || "__none__"} onValueChange={(v) => setTplId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="mt-1" data-testid="crm-template-select"><SelectValue placeholder="Pick a template" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {templates.map(t => <SelectItem key={t.template_id} value={t.template_id}>{t.name} ({t.stages.length} stages)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-500">Start date (ATS)</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" data-testid="crm-start-date" />
            </div>
          </div>
          <div className="flex gap-2 mb-4">
            <Button variant="outline" onClick={applyTemplate} disabled={!tplId} data-testid="crm-apply-template-btn">Apply template</Button>
            <Button variant="ghost" onClick={addRow}><Plus className="w-4 h-4 mr-1" /> Add row</Button>
          </div>
          {schedule.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stage</TableHead><TableHead>%</TableHead><TableHead>Amount ₹</TableHead><TableHead>Due date</TableHead><TableHead>Notes</TableHead><TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.map((r, i) => (
                    <TableRow key={i} data-testid={`sched-row-${i}`}>
                      <TableCell><Input value={r.stage_name} onChange={(e) => upd(i, "stage_name", e.target.value)} placeholder="Booking / ATS / 30 days" /></TableCell>
                      <TableCell className="w-24"><Input type="number" value={r.percent} onChange={(e) => upd(i, "percent", e.target.value)} /></TableCell>
                      <TableCell className="w-40"><Input type="number" value={r.amount} onChange={(e) => upd(i, "amount", e.target.value)} /></TableCell>
                      <TableCell className="w-40"><Input type="date" value={r.due_date} onChange={(e) => upd(i, "due_date", e.target.value)} /></TableCell>
                      <TableCell><Input value={r.notes || ""} onChange={(e) => upd(i, "notes", e.target.value)} placeholder="—" /></TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => rm(i)}><X className="w-4 h-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between items-center mt-4">
                <div className="text-xs text-stone-500">Total: <span className="font-mono font-semibold text-stone-900">{fmt(totalScheduled)}</span> of {fmt(unit.total_price || 0)}
                  {totalScheduled !== (unit.total_price || 0) && <span className="text-rose-700 ml-2">Δ {fmt(totalScheduled - (unit.total_price || 0))}</span>}
                </div>
                <Button className="bg-emerald-900 hover:bg-emerald-800" onClick={saveSchedule} data-testid="crm-save-schedule-btn">Save schedule</Button>
              </div>
            </>
          )}
        </div>
      )}

      {installments.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl">
          <div className="p-5 border-b border-stone-200 flex items-baseline justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-stone-500">Payment schedule</div>
              <div className="text-lg font-semibold text-stone-900 mt-0.5">{installments.length} installments · {fmt(totalReceived)} of {fmt(unit.total_price || 0)} received</div>
            </div>
            {readOnly && canSchedule && (
              <div className="text-xs text-stone-500">Schedule locked — cancel the sale to reset</div>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage</TableHead><TableHead>%</TableHead><TableHead>Amount</TableHead><TableHead>Due date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {installments.map(inst => {
                const meta = INST_META[inst.status] || INST_META.upcoming;
                return (
                  <TableRow key={inst.installment_id} data-testid={`inst-row-${inst.stage_name}`}>
                    <TableCell className="font-medium">{inst.stage_name}</TableCell>
                    <TableCell>{inst.percent}%</TableCell>
                    <TableCell>{fmt(inst.amount)}</TableCell>
                    <TableCell className="text-stone-600">{inst.due_date}</TableCell>
                    <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${meta.tone}`}>{meta.label}</span></TableCell>
                    <TableCell className="text-right">
                      {["upcoming","due_soon","due_today","overdue"].includes(inst.status) && isCRM && (
                        <Button size="sm" variant="outline" onClick={() => claim(inst.installment_id)} data-testid={`claim-btn-${inst.stage_name}`}>
                          <Clock className="w-3 h-3 mr-1" /> Customer claimed
                        </Button>
                      )}
                      {inst.status === "payment_claimed" && isAcctRep && (
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => verify(inst.installment_id, false)}>Not reflected</Button>
                          <Button size="sm" className="bg-emerald-900 hover:bg-emerald-800" onClick={() => verify(inst.installment_id, true)} data-testid={`verify-btn-${inst.stage_name}`}>Reflected</Button>
                        </div>
                      )}
                      {inst.status === "pending_head_approval" && isAcctHead && (
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => approve(inst.installment_id, "reject")}>Reject</Button>
                          <Button size="sm" className="bg-emerald-900 hover:bg-emerald-800" onClick={() => approve(inst.installment_id, "approve")} data-testid={`approve-btn-${inst.stage_name}`}>
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                          </Button>
                        </div>
                      )}
                      {["paid","partial"].includes(inst.status) && <span className="text-xs text-emerald-800">Received</span>}
                      {inst.status === "not_reflected" && <span className="text-xs text-rose-700">Follow up</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon: Icon, label, primary, sub }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-stone-500">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-stone-900">{primary}</div>
      {sub && <div className="text-xs text-stone-500 mt-0.5">{sub}</div>}
    </div>
  );
}
