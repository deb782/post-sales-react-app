import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { Building2, Home, IndianRupee, Receipt, TrendingUp, AlertCircle } from "lucide-react";
import { useProjectFilter } from "@/components/ProjectFilter";

const COLORS = ["#064e3b", "#f59e0b", "#e11d48", "#78716c", "#3b82f6"];

const fmt = (n = 0) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function Dashboard() {
  const [data, setData] = useState(null);
  const { user } = useAuth();
  const { ProjectFilter, projectId } = useProjectFilter();

  useEffect(() => {
    (async () => {
      const params = projectId ? { project_id: projectId } : {};
      const { data } = await api.get("/dashboard/summary", { params });
      setData(data);
    })();
  }, [projectId]);

  if (!data) return <div className="text-stone-500">Loading…</div>;

  const unitBar = [
    { name: "Sold", value: data.units.sold },
    { name: "Available", value: data.units.available },
    { name: "Reserved", value: data.units.reserved },
  ];
  const expPie = [
    { name: "Pending", value: data.expenses.pending },
    { name: "Stage-1", value: data.expenses.stage1 },
    { name: "Approved", value: data.expenses.approved },
    { name: "Rejected", value: data.expenses.rejected },
  ];

  return (
    <div className="space-y-8" data-testid="dashboard-root">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500">Welcome</div>
          <h1 className="mt-1 text-4xl font-bold text-stone-900">Hello, {user.name}</h1>
          <p className="mt-1 text-stone-500 text-sm">Here&apos;s what&apos;s happening across your projects today.</p>
        </div>
        <ProjectFilter />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Projects" value={data.projects_count} icon={Building2} />
        <Kpi label="Units Sold" value={`${data.units.sold} / ${data.units.total}`} icon={Home} accent="emerald" />
        <Kpi label="Revenue Received" value={fmt(data.revenue.received)} icon={IndianRupee} accent="emerald" />
        <Kpi label="Pending Approvals" value={data.expenses.pending + data.expenses.stage1} icon={AlertCircle} accent="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-stone-500">Revenue vs Target</div>
              <div className="text-2xl font-bold mt-1">{fmt(data.revenue.received)}</div>
            </div>
            <TrendingUp className="w-5 h-5 text-emerald-800" />
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <Bucket label="Accrued" value={fmt(data.revenue.accrued)} />
            <Bucket label="Received" value={fmt(data.revenue.received)} tone="emerald" />
            <Bucket label="Receivable" value={fmt(data.revenue.receivable)} tone="amber" />
          </div>
          <div className="h-2 bg-stone-100 rounded-full mt-6 overflow-hidden">
            <div
              className="h-full bg-emerald-800"
              style={{ width: `${data.revenue.target ? Math.min(100, (data.revenue.received / data.revenue.target) * 100) : 0}%` }}
            />
          </div>
          <div className="text-xs text-stone-500 mt-1">
            Target: {fmt(data.revenue.target)}
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-4">Inventory Status</div>
          <div style={{ width: "100%", height: 200, minHeight: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={unitBar}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="name" stroke="#78716c" fontSize={12} />
                <YAxis stroke="#78716c" fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {unitBar.map((_, i) => (<Cell key={i} fill={COLORS[i]} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-4">Expenses by Status</div>
          <div style={{ width: "100%", height: 220, minHeight: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expPie} innerRadius={45} outerRadius={80} dataKey="value" paddingAngle={2}>
                  {expPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-sm text-stone-600 mt-2">Approved value: <b>{fmt(data.expenses.approved_amount)}</b></div>
        </div>

        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-4">Approved Expenses (last 30 days)</div>
          <div style={{ width: "100%", height: 220, minHeight: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.expense_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="date" stroke="#78716c" fontSize={11} />
                <YAxis stroke="#78716c" fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="amount" stroke="#064e3b" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent }) {
  const tone =
    accent === "emerald" ? "text-emerald-800 bg-emerald-50" :
    accent === "amber" ? "text-amber-800 bg-amber-50" :
    "text-stone-700 bg-stone-100";
  return (
    <div className="kpi-card" data-testid={`kpi-${label.toLowerCase().replace(/\s+/g,"-")}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="kpi-label">{label}</div>
          <div className="kpi-value">{value}</div>
        </div>
        <div className={`w-10 h-10 rounded-md flex items-center justify-center ${tone}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
function Bucket({ label, value, tone }) {
  const cls = tone === "emerald" ? "text-emerald-800" : tone === "amber" ? "text-amber-800" : "text-stone-900";
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-stone-500">{label}</div>
      <div className={`text-lg font-semibold mt-0.5 ${cls}`}>{value}</div>
    </div>
  );
}
