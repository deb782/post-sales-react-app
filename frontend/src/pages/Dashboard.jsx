import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Building2, Home, IndianRupee, Receipt, AlertCircle, TicketCheck,
  CheckCircle2, Circle, ChevronRight,
} from "lucide-react";

const COLORS = ["#064e3b", "#f59e0b", "#e11d48", "#78716c", "#3b82f6"];
const fmt = (n = 0) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(null);
  const [selectedProject, setSelectedProject] = useState("__all__");

  useEffect(() => {
    (async () => {
      const [d, s] = await Promise.all([
        api.get("/dashboard/summary"),
        api.get("/onboarding/status").catch(() => ({ data: null })),
      ]);
      setData(d.data);
      setStatus(s.data);
    })();
  }, []);

  const perProject = data?.per_project || [];
  const activeProject = useMemo(() => {
    if (selectedProject === "__all__") return null;
    return perProject.find(p => p.project_id === selectedProject);
  }, [selectedProject, perProject]);

  if (!data) return <div className="text-stone-500">Loading…</div>;

  const totals = {
    accrued: data.revenue.accrued,
    received: data.revenue.received,
    receivable: data.revenue.receivable,
  };
  const revView = activeProject || totals;
  const revLabel = activeProject ? activeProject.name : "All projects";

  const unitBar = [
    { name: "Sold", value: data.units.sold },
    { name: "Available", value: data.units.available },
  ];
  const expPie = [
    { name: "Pending", value: data.expenses.pending },
    { name: "Stage-1", value: data.expenses.stage1 },
    { name: "Approved", value: data.expenses.approved },
    { name: "Rejected", value: data.expenses.rejected },
  ];

  const setupDone = status?.done_count || 0;
  const setupTotal = status?.total_steps || 7;
  const setupPct = Math.round((setupDone / setupTotal) * 100);
  const showSetup = status && !status.system_ready && user.role === "super_admin";

  return (
    <div className="space-y-8" data-testid="dashboard-root">
      <div>
        <div className="text-xs uppercase tracking-widest text-stone-500">Welcome</div>
        <h1 className="mt-1 text-4xl font-bold text-stone-900">Hello, {user.name}</h1>
        <p className="mt-1 text-stone-500 text-sm">Portfolio snapshot as of today.</p>
      </div>

      {showSetup && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6" data-testid="setup-tracker">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-emerald-900">Setup progress</div>
              <div className="text-lg font-semibold text-stone-900 mt-0.5">{setupDone} of {setupTotal} steps complete</div>
            </div>
            <div className="text-2xl font-bold text-emerald-900">{setupPct}%</div>
          </div>
          <div className="h-2 bg-white rounded-full overflow-hidden mb-4">
            <div className="h-full bg-emerald-900 transition-all" style={{ width: `${setupPct}%` }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {(status?.steps || []).map(s => (
              <div key={s.key} className={`flex items-start gap-2 p-2 rounded-md ${s.done ? "text-stone-500" : "text-stone-800"}`} data-testid={`step-${s.key}`}>
                {s.done ? <CheckCircle2 className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />}
                <span className={`text-xs ${s.done ? "line-through" : "font-medium"}`}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Projects" value={data.projects_count} icon={Building2} onClick={() => nav("/projects")} />
        <Kpi label="Units Sold" value={`${data.units.sold} / ${data.units.total}`} icon={Home} accent="emerald" onClick={() => nav("/units")} />
        <Kpi label="Revenue Received" value={fmt(data.revenue.received)} icon={IndianRupee} accent="emerald" onClick={() => nav("/revenue")} />
        <Kpi label="Approvals Pending" value={data.expenses.pending + data.expenses.stage1} icon={AlertCircle} accent="amber" onClick={() => nav("/expenses")} />
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-6" data-testid="revenue-card">
        <div className="flex items-baseline justify-between flex-wrap gap-3 mb-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-stone-500">Revenue overview</div>
            <div className="text-lg font-semibold text-stone-900 mt-0.5">{revLabel}</div>
          </div>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-56" data-testid="revenue-project-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All projects (rollup)</SelectItem>
              {perProject.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <Bucket label="Accrued" value={fmt(revView.accrued || 0)} />
          <Bucket label="Received" value={fmt(revView.received || 0)} tone="emerald" />
          <Bucket label="Receivable" value={fmt(revView.receivable || 0)} tone="amber" />
        </div>
        {activeProject && (
          <div className="mt-4 pt-4 border-t border-stone-100 text-xs text-stone-500 flex gap-6">
            <div><span className="text-stone-800 font-medium">{activeProject.units_sold}</span> / {activeProject.units_total} units sold</div>
            <div>Type: <span className="text-stone-800 font-medium capitalize">{activeProject.project_type?.replace("_", " ")}</span></div>
            {activeProject.location && <div>Location: <span className="text-stone-800 font-medium">{activeProject.location}</span></div>}
          </div>
        )}
      </div>

      {perProject.length > 1 && (
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-3">Project status</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {perProject.map(p => {
              const pct = p.units_total > 0 ? Math.round((p.units_sold / p.units_total) * 100) : 0;
              return (
                <button key={p.project_id} onClick={() => nav("/projects")} className="text-left bg-white border border-stone-200 rounded-xl p-5 hover:border-stone-300 hover:shadow-sm transition-all" data-testid={`project-status-${p.project_id}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-stone-900">{p.name}</div>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">{p.location || "—"}</div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-stone-500">Units sold</div>
                      <div className="text-stone-900 font-semibold mt-0.5">{p.units_sold} / {p.units_total}</div>
                    </div>
                    <div>
                      <div className="text-stone-500">Received</div>
                      <div className="text-emerald-800 font-semibold mt-0.5">{fmt(p.received)}</div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-800" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] text-stone-500 text-right">{pct}% inventory booked</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-4">Inventory status</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={unitBar}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="name" stroke="#78716c" fontSize={12} />
                <YAxis stroke="#78716c" fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>{unitBar.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-4">Expenses by status</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={expPie} innerRadius={45} outerRadius={80} dataKey="value" paddingAngle={2}>
                  {expPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-sm text-stone-600 mt-2">Approved value: <b>{fmt(data.expenses.approved_amount)}</b></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SmallTile icon={Receipt} label="Approved amount" value={fmt(data.expenses.approved_amount)} />
        <SmallTile icon={TicketCheck} label="Tickets open" value={data.tickets_open || 0} onClick={() => nav("/tickets")} />
        <SmallTile icon={IndianRupee} label="Receivable balance" value={fmt(data.revenue.receivable)} />
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent, onClick }) {
  const tone =
    accent === "emerald" ? "text-emerald-800 bg-emerald-50" :
    accent === "amber" ? "text-amber-800 bg-amber-50" :
    "text-stone-700 bg-stone-100";
  return (
    <button onClick={onClick} className="kpi-card text-left" data-testid={`kpi-${label.toLowerCase().replace(/\s+/g,"-")}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="kpi-label">{label}</div>
          <div className="kpi-value">{value}</div>
        </div>
        <div className={`w-10 h-10 rounded-md flex items-center justify-center ${tone}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </button>
  );
}

function Bucket({ label, value, tone }) {
  const cls = tone === "emerald" ? "text-emerald-800" : tone === "amber" ? "text-amber-800" : "text-stone-900";
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-stone-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}

function SmallTile({ icon: Icon, label, value, onClick }) {
  return (
    <button onClick={onClick} className="text-left bg-white border border-stone-200 rounded-xl p-4 hover:border-stone-300 transition-colors">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-stone-500">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-stone-900">{value}</div>
    </button>
  );
}
