import { useEffect, useRef, useState } from "react";
import { api, API_BASE, apiError } from "@/lib/api";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { User, Mail, Phone, Shield, Camera, KeyRound, Building2, Check, Eye, EyeOff } from "lucide-react";

export default function Profile() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ name: "", phone: "" });
  const [projects, setProjects] = useState([]);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showCur, setShowCur] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) setForm({ name: user.name || "", phone: user.phone || "" });
    if (user?.role === "site_supervisor") {
      api.get("/projects").then(r => setProjects(r.data)).catch(() => {});
    }
  }, [user]);

  if (!user) return null;

  const initials = user.name?.split(" ").map(x => x[0]).join("").toUpperCase().slice(0, 2);
  const pic = user.picture
    ? (user.picture.startsWith("/api") ? `${API_BASE}${user.picture.replace("/api", "")}` : user.picture)
    : null;

  const rules = [
    { key: "len", label: "At least 10 characters", check: (p) => p.length >= 10 },
    { key: "upp", label: "One uppercase letter", check: (p) => /[A-Z]/.test(p) },
    { key: "low", label: "One lowercase letter", check: (p) => /[a-z]/.test(p) },
    { key: "num", label: "One number", check: (p) => /\d/.test(p) },
    { key: "sym", label: "One symbol", check: (p) => /[^a-zA-Z0-9]/.test(p) },
  ];
  const pwValid = rules.every(r => r.check(pwForm.next)) && pwForm.next === pwForm.confirm;

  const saveProfile = async () => {
    try {
      await api.patch("/me/profile", { name: form.name, phone: form.phone });
      toast.success("Profile updated");
      refresh();
    } catch (e) { toast.error(apiError(e)); }
  };

  const uploadPic = async (f) => {
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      await api.post("/me/picture", fd);
      toast.success("Photo updated");
      refresh();
    } catch (e) { toast.error(apiError(e)); }
    finally { setUploading(false); }
  };

  const changePw = async () => {
    if (!pwValid) return toast.error("Password doesn't meet all rules or doesn't match");
    try {
      await api.post("/auth/change-password", { current_password: pwForm.current, new_password: pwForm.next });
      toast.success("Password updated");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (e) { toast.error(apiError(e)); }
  };

  const myProjects = (user.project_ids || []).map(pid => projects.find(p => p.project_id === pid)).filter(Boolean);

  return (
    <div className="space-y-8" data-testid="profile-root">
      {/* Hero banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-stone-900 p-8 text-white">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.1) 0%, transparent 50%)" }} />
        <div className="relative flex items-center gap-6">
          <div className="relative">
            {pic ? (
              <img src={pic} alt="" className="w-24 h-24 rounded-full object-cover border-4 border-white/20 shadow-xl" data-testid="profile-avatar" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-white/10 border-4 border-white/20 flex items-center justify-center text-3xl font-bold backdrop-blur">
                {initials}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-white text-emerald-900 flex items-center justify-center shadow-lg hover:scale-110 transition-transform disabled:opacity-50"
              data-testid="upload-picture-btn"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadPic(e.target.files?.[0])} data-testid="picture-file-input" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-emerald-200">{ROLE_LABELS[user.role]}</div>
            <h1 className="text-3xl font-bold mt-1">{user.name}</h1>
            <div className="mt-1 text-sm text-emerald-100">{user.email}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — personal details form */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white border border-stone-200 rounded-xl p-6">
            <div className="flex items-baseline justify-between mb-1">
              <div>
                <div className="text-xs uppercase tracking-widest text-stone-500">Section 1</div>
                <h2 className="text-xl font-bold text-stone-900 mt-0.5">Personal details</h2>
              </div>
            </div>
            <p className="text-sm text-stone-500 mb-6">Update how your name appears across notifications and audit logs.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field icon={User} label="Full name">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="profile-name-input" />
              </Field>
              <Field icon={Mail} label="Email" hint="Managed by admin — cannot be changed here">
                <Input value={user.email} disabled className="opacity-60" />
              </Field>
              <Field icon={Phone} label="Phone">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98200 00000" data-testid="profile-phone-input" />
              </Field>
              <Field icon={Shield} label="Role" hint="Managed by admin">
                <Input value={ROLE_LABELS[user.role]} disabled className="opacity-60" />
              </Field>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={saveProfile} className="bg-emerald-900 hover:bg-emerald-800" data-testid="save-profile-btn">Save changes</Button>
            </div>
          </section>

          {/* Change password */}
          <section className="bg-white border border-stone-200 rounded-xl p-6">
            <div className="flex items-baseline justify-between mb-1">
              <div>
                <div className="text-xs uppercase tracking-widest text-stone-500">Section 2</div>
                <h2 className="text-xl font-bold text-stone-900 mt-0.5 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-emerald-800" /> Change password
                </h2>
              </div>
            </div>
            <p className="text-sm text-stone-500 mb-6">Keep your account secure. Pick something you'll remember but nobody else could guess.</p>

            <div className="space-y-4">
              <Field icon={KeyRound} label="Current password">
                <PasswordInput value={pwForm.current} onChange={(v) => setPwForm({ ...pwForm, current: v })} show={showCur} toggle={() => setShowCur(!showCur)} testId="current-password-input" />
              </Field>
              <Field icon={KeyRound} label="New password">
                <PasswordInput value={pwForm.next} onChange={(v) => setPwForm({ ...pwForm, next: v })} show={showNext} toggle={() => setShowNext(!showNext)} testId="new-password-input" />
              </Field>
              <Field icon={KeyRound} label="Confirm new password">
                <PasswordInput value={pwForm.confirm} onChange={(v) => setPwForm({ ...pwForm, confirm: v })} show={showNext} toggle={() => setShowNext(!showNext)} testId="confirm-password-input" />
              </Field>

              <div className="grid grid-cols-2 gap-2 pt-2">
                {rules.map(r => {
                  const ok = r.check(pwForm.next);
                  return (
                    <div key={r.key} className={`flex items-center gap-1.5 text-xs ${ok ? "text-emerald-800" : "text-stone-500"}`}>
                      <Check className={`w-3 h-3 ${ok ? "opacity-100" : "opacity-30"}`} /> {r.label}
                    </div>
                  );
                })}
                <div className={`flex items-center gap-1.5 text-xs col-span-2 ${pwForm.next && pwForm.next === pwForm.confirm ? "text-emerald-800" : "text-stone-500"}`}>
                  <Check className={`w-3 h-3 ${pwForm.next && pwForm.next === pwForm.confirm ? "opacity-100" : "opacity-30"}`} /> Passwords match
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button onClick={changePw} disabled={!pwValid || !pwForm.current} className="bg-emerald-900 hover:bg-emerald-800 disabled:opacity-40" data-testid="save-password-btn">Update password</Button>
              </div>
            </div>
          </section>
        </div>

        {/* Right column — sidebar with quick facts */}
        <aside className="space-y-6">
          <div className="bg-white border border-stone-200 rounded-xl p-6">
            <div className="text-xs uppercase tracking-widest text-stone-500 mb-4">Account</div>
            <StatRow label="Status" value={
              user.is_active
                ? <span className="text-emerald-800 font-medium">Active</span>
                : <span className="text-stone-500 font-medium">Inactive</span>
            } />
            <StatRow label="Role" value={ROLE_LABELS[user.role]} />
            <StatRow label="Onboarded" value={user.onboarding_completed ? "Yes" : "In progress"} />
            <StatRow label="Reset pending" value={user.must_reset_password ? "Yes" : "No"} last />
          </div>

          {user.role === "site_supervisor" && (
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <div className="text-xs uppercase tracking-widest text-stone-500 mb-4 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> My projects
              </div>
              {myProjects.length === 0 ? (
                <div className="text-sm text-stone-500">No projects assigned yet. Ask an Admin.</div>
              ) : (
                <ul className="space-y-2">
                  {myProjects.map(p => (
                    <li key={p.project_id} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-700" />
                      <span className="text-stone-800">{p.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="bg-gradient-to-br from-stone-50 to-white border border-stone-200 rounded-xl p-6">
            <div className="text-xs uppercase tracking-widest text-stone-500 mb-2">Tip</div>
            <p className="text-sm text-stone-700">
              Keep your phone up to date — it's used for critical account recovery and sensitive-action confirmations.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, hint, children }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-stone-500 flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </label>
      {hint && <div className="text-[10px] text-stone-400 mt-0.5">{hint}</div>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function StatRow({ label, value, last }) {
  return (
    <div className={`flex items-center justify-between py-2 ${last ? "" : "border-b border-stone-100"}`}>
      <div className="text-xs text-stone-500">{label}</div>
      <div className="text-sm text-stone-900">{value}</div>
    </div>
  );
}

function PasswordInput({ value, onChange, show, toggle, testId }) {
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} className="pr-10" />
      <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
