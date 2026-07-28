import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth, can } from "@/lib/auth";
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
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";

const fmt = (n = 0) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

/**
 * Suggest period keys for the current + previous few months/quarters.
 */
function suggestPeriods(kind) {
  const now = new Date();
  const out = [];
  if (kind === "monthly") {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 0; i < 12; i++) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      out.push(`${y}-${m}`);
      d.setMonth(d.getMonth() - 1);
    }
  } else {
    let y = now.getFullYear();
    let q = Math.floor(now.getMonth() / 3) + 1;
    for (let i = 0; i < 8; i++) {
      out.push(`${y}-Q${q}`);
      q -= 1;
      if (q === 0) { q = 4; y -= 1; }
    }
  }
  return out;
}

export default function RevenueTargets({ projectId, projects }) {
  const { user } = useAuth();
  const [kind, setKind] = useState("monthly");
  const [items, setItems] = useState([]);
  const [variance, setVariance] = useState({ series: [] });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ project_id: "", period_key: "", amount: 0 });

  const load = async () => {
    const params = { period_type: kind };
    if (projectId) params.project_id = projectId;
    const [t, v] = await Promise.all([
      api.get("/revenue-targets", { params }),
      api.get("/revenue-targets/variance", { params: { ...params, periods: 6 } }),
    ]);
    setItems(t.data);
    setVariance(v.data);
  };
  useEffect(() => { load(); }, [kind, projectId]);

  const projMap = useMemo(() => Object.fromEntries(projects.map(p => [p.project_id, p.name])), [projects]);
  const suggestions = suggestPeriods(kind);

  const save = async () => {
    if (!form.project_id || !form.period_key) { toast.error("Project and period required"); return; }
    try {
      await api.post("/revenue-targets", {
        project_id: form.project_id,
        period_type: kind,
        period_key: form.period_key,
        amount: Number(form.amount) || 0,
      });
      toast.success("Target saved");
      setOpen(false); setForm({ project_id: "", period_key: "", amount: 0 });
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const del = async (t) => {
    if (!window.confirm(`Delete target for ${t.period_key}?`)) return;
    await api.delete(`/revenue-targets/${t.target_id}`);
    toast.success("Deleted");
    load();
  };

  const chartData = variance.series.map(s => ({
    period: s.period_key,
    Target: s.target,
    Received: s.received,
    Accrued: s.accrued,
  }));

  return (
    <div className="bg-white border border-stone-200 rounded-xl" data-testid="revenue-targets-section">
      <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-800" />
          <div className="font-semibold text-sm">Revenue Targets</div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-36" data-testid="target-kind-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
          {can(user, "admin") && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-emerald-900 hover:bg-emerald-800" data-testid="add-target-btn">
                  <Plus className="w-4 h-4 mr-1" /> Add Target
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Set {kind === "monthly" ? "monthly" : "quarterly"} target</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                    <SelectTrigger data-testid="target-project-select"><SelectValue placeholder="Project" /></SelectTrigger>
                    <SelectContent>{projects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={form.period_key} onValueChange={(v) => setForm({ ...form, period_key: v })}>
                    <SelectTrigger data-testid="target-period-select"><SelectValue placeholder="Period" /></SelectTrigger>
                    <SelectContent>{suggestions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" placeholder="Target amount (₹)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="target-amount-input" />
                  <div className="text-xs text-stone-500">Existing targets for the same project/period will be overwritten.</div>
                </div>
                <DialogFooter><Button data-testid="save-target-btn" onClick={save} className="bg-emerald-900 hover:bg-emerald-800">Save</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="p-4">
        <div style={{ width: "100%", height: 240, minHeight: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="period" stroke="#78716c" fontSize={11} />
              <YAxis stroke="#78716c" fontSize={11} tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${v/1000}k`} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Target" fill="#a8a29e" radius={[4,4,0,0]} />
              <Bar dataKey="Received" fill="#064e3b" radius={[4,4,0,0]} />
              <Bar dataKey="Accrued" fill="#f59e0b" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead>Project</TableHead>
            <TableHead className="text-right">Target</TableHead>
            <TableHead className="text-right">Received</TableHead>
            <TableHead className="text-right">Accrued</TableHead>
            <TableHead className="text-right">Var. (Received)</TableHead>
            <TableHead className="text-right">Var. (Accrued)</TableHead>
            {can(user, "admin") && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(t => {
            const row = variance.series.find(s => s.period_key === t.period_key);
            const varRec = row ? row.variance_received : (-t.amount);
            const varAcc = row ? row.variance_accrued : 0;
            const rec = row ? row.received : 0;
            const acc = row ? row.accrued : 0;
            return (
              <TableRow key={t.target_id}>
                <TableCell className="font-medium">{t.period_key}</TableCell>
                <TableCell className="text-stone-600">{projMap[t.project_id] || "—"}</TableCell>
                <TableCell className="text-right">{fmt(t.amount)}</TableCell>
                <TableCell className="text-right text-emerald-800">{fmt(rec)}</TableCell>
                <TableCell className="text-right text-amber-800">{fmt(acc)}</TableCell>
                <TableCell className={`text-right font-medium ${varRec >= 0 ? "text-emerald-800" : "text-rose-700"}`}>
                  {varRec >= 0 ? "+" : ""}{fmt(varRec)}
                </TableCell>
                <TableCell className={`text-right font-medium ${varAcc >= 0 ? "text-emerald-800" : "text-rose-700"}`}>
                  {varAcc >= 0 ? "+" : ""}{fmt(varAcc)}
                </TableCell>
                {can(user, "admin") && (
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => del(t)} className="text-rose-700" data-testid={`delete-target-${t.target_id}`}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={can(user,"admin") ? 8 : 7} className="text-center py-10 text-stone-500">
              <Target className="w-6 h-6 mx-auto mb-2 text-stone-300" />
              No {kind} targets yet
            </TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
