import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Check, ChevronRight, UserPlus, Copy, ArrowRight, LayoutDashboard, Building2 } from "lucide-react";

const TEAM_ROLES = ["process_admin", "crm_head", "sales_head", "accounts_head",
                    "sales_rep", "post_sales_rep", "accounts_rep"];

export default function Onboarding() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ email: "", name: "", role: "process_admin", phone: "" });
  const [lastInvite, setLastInvite] = useState(null);
  const [users, setUsers] = useState([]);

  const reload = useCallback(async () => {
    const [{ data: st }, { data: us }] = await Promise.all([
      api.get("/onboarding/status"),
      api.get("/users").catch(() => ({ data: [] })),
    ]);
    setStatus(st);
    setUsers(us);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const invite = async () => {
    if (!form.email || !form.name) return toast.error("Name and email required");
    try {
      const { data } = await api.post("/users", form);
      setLastInvite(data);
      toast.success(`Invited ${data.user.name}${data.email_sent ? " — email sent" : ""}`);
      setForm({ ...form, email: "", name: "", phone: "" });
      reload();
    } catch (e) { toast.error(apiError(e)); }
  };

  const skip = async () => {
    await api.post("/onboarding/complete");
    await refresh();
    nav("/dashboard", { replace: true });
  };

  const goToProject = async () => {
    await api.post("/onboarding/complete");
    await refresh();
    nav("/projects", { replace: true, state: { openCreate: true } });
  };

  if (!status) return <div className="p-8 text-stone-500">Loading…</div>;

  const roleCountKey = (r) => {
    if (r === "process_admin" || r === "crm_head") return "management";
    if (r === "sales_head" || r === "sales_rep") return "sales";
    if (r === "accounts_head" || r === "accounts_rep") return "accounts";
    if (r === "post_sales_rep") return "crm";
    return r;
  };
  const teamDone = TEAM_ROLES.every(r => status.counts[roleCountKey(r)] > 0);
  const invitedCount = users.filter(u => u.role !== "super_admin").length;

  return (
    <div className="min-h-screen bg-stone-50" data-testid="onboarding-root">
      <div className="max-w-5xl mx-auto p-8">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-widest text-stone-500">First-run setup</div>
          <h1 className="text-4xl font-bold text-stone-900 mt-1">Build your team</h1>
          <p className="text-stone-600 mt-2 text-sm max-w-2xl">
            Invite the people who&apos;ll run the operation. Sales books plots. CRM schedules payments. Accounts confirms money in. Management approves expenses. Once your team is in, add your first project — or skip to the dashboard and do it later.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-8">
          {TEAM_ROLES.slice(0, 4).map(r => (
            <RoleTile key={r} role={r} count={status.counts[roleCountKey(r)] || 0} />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          {TEAM_ROLES.slice(4).map(r => (
            <RoleTile key={r} role={r} count={status.counts[roleCountKey(r)] || 0} />
          ))}
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-xl font-bold text-stone-900">Invite a teammate</h2>
            <div className="text-xs text-stone-500">{invitedCount} invited so far</div>
          </div>
          <p className="text-sm text-stone-500 mb-5">They&apos;ll get an email with a temp password. First login forces a reset.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rahul Iyer" data-testid="invite-name-input" />
            </Field>
            <Field label="Work email" required>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="rahul.iyer@company.com" data-testid="invite-email-input" />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98200 00000" />
            </Field>
            <Field label="Role" required>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="invite-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEAM_ROLES.map(r => (
                    <SelectItem key={r} value={r} data-testid={`role-option-${r}`}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                <SelectItem value="site_supervisor" data-testid="role-option-site_supervisor">{ROLE_LABELS.site_supervisor}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 justify-between">
            <div className="text-xs text-stone-500">
              {teamDone
                ? "All core roles invited. You can invite more or move on."
                : `Still needed: ${TEAM_ROLES.filter(r => !(status.counts[roleCountKey(r)] > 0)).map(r => ROLE_LABELS[r]).join(", ")}`}
            </div>
            <div className="flex gap-2">
              <Button onClick={invite} className="bg-emerald-900 hover:bg-emerald-800" data-testid="invite-user-btn">
                <UserPlus className="w-4 h-4 mr-1" /> Invite
              </Button>
            </div>
          </div>

          {lastInvite && (
            <div className="mt-6 p-4 rounded-lg border border-emerald-200 bg-emerald-50" data-testid="invite-details">
              <div className="text-sm font-semibold text-emerald-900">
                {lastInvite.user.name} invited as {ROLE_LABELS[lastInvite.user.role]}
              </div>
              <div className="mt-2 text-xs text-stone-700 space-y-1 font-mono">
                <div>Portal: {lastInvite.login_url}</div>
                <div>Login ID: {lastInvite.user.email}</div>
                <div>Temporary password: {lastInvite.temp_password}</div>
              </div>
              {!lastInvite.email_sent && (
                <div className="mt-2 text-[11px] text-amber-800">
                  SMTP not configured — copy the details and share manually.
                </div>
              )}
              <Button size="sm" variant="outline" className="mt-3" onClick={() => {
                navigator.clipboard.writeText(
                  `Portal: ${lastInvite.login_url}\nLogin: ${lastInvite.user.email}\nTemporary password: ${lastInvite.temp_password}`);
                toast.success("Copied to clipboard");
              }} data-testid="copy-invite-btn">
                <Copy className="w-3 h-3 mr-1" /> Copy details
              </Button>
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChoiceCard
            icon={Building2}
            title="Add your first project"
            body="Create a project now, assign a site manager, then land on the dashboard. Recommended if you already know what you're launching."
            cta="Add project"
            testId="go-to-project-btn"
            onClick={goToProject}
            primary
          />
          <ChoiceCard
            icon={LayoutDashboard}
            title="Skip to dashboard"
            body="You can add projects later. The dashboard will show a setup tracker guiding you through what's left."
            cta="Go to dashboard"
            testId="skip-onboarding-btn"
            onClick={skip}
          />
        </div>
      </div>
    </div>
  );
}

function RoleTile({ role, count }) {
  const done = count > 0;
  return (
    <div className={`p-4 rounded-xl border-2 transition-colors ${done ? "border-emerald-300 bg-emerald-50" : "border-stone-200 bg-white"}`} data-testid={`role-tile-${role}`}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-stone-500">{ROLE_LABELS[role]}</div>
        {done && <Check className="w-4 h-4 text-emerald-800" />}
      </div>
      <div className={`mt-2 text-2xl font-bold ${done ? "text-emerald-900" : "text-stone-400"}`}>{count}</div>
      <div className="text-[11px] text-stone-500 mt-0.5">{done ? (count > 1 ? "invited" : "invited") : "not invited yet"}</div>
    </div>
  );
}

function ChoiceCard({ icon: Icon, title, body, cta, testId, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`text-left p-6 rounded-xl border transition-all group ${primary ? "bg-emerald-900 border-emerald-900 text-white hover:bg-emerald-800" : "bg-white border-stone-200 text-stone-900 hover:border-stone-300"}`}
    >
      <div className="flex items-center justify-between">
        <Icon className={`w-6 h-6 ${primary ? "text-emerald-200" : "text-stone-500"}`} />
        <ArrowRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${primary ? "text-emerald-200" : "text-stone-400"}`} />
      </div>
      <div className="mt-4 text-lg font-semibold">{title}</div>
      <div className={`mt-2 text-sm ${primary ? "text-emerald-100" : "text-stone-500"}`}>{body}</div>
      <div className={`mt-4 inline-flex items-center gap-1 text-sm font-medium ${primary ? "text-white" : "text-emerald-900"}`}>
        {cta} <ChevronRight className="w-4 h-4" />
      </div>
    </button>
  );
}

function Field({ label, children, required }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-stone-500">
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
