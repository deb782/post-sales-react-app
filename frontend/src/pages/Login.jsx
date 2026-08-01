import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useBranding } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, ShieldCheck, LineChart, Eye, EyeOff } from "lucide-react";
import { apiError } from "@/lib/api";
import { toast } from "sonner";

export default function Login() {
  const { user, loading, login } = useAuth();
  const { company_name, logo_url } = useBranding();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav(user.must_reset_password ? "/reset-password" : "/dashboard", { replace: true });
  }, [user, loading, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await login(email.trim().toLowerCase(), password);
      if (res.must_reset_password) {
        toast.info("Please set a new password to continue.");
        nav("/reset-password", { replace: true });
      } else {
        nav("/dashboard", { replace: true });
      }
    } catch (err) {
      toast.error(apiError(err, "Login failed"));
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-5 bg-stone-50">
      <div className="hidden lg:flex lg:col-span-3 relative bg-stone-900 text-white p-12 flex-col justify-between overflow-hidden grain">
        <div className="absolute inset-0 opacity-30 pointer-events-none"
             style={{ backgroundImage: "url('https://images.pexels.com/photos/20273065/pexels-photo-20273065.jpeg')", backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="absolute inset-0 bg-gradient-to-tr from-stone-950 via-stone-900/70 to-transparent" />
        <div className="relative z-10 flex items-center gap-3">
          {logo_url ? <img src={logo_url} alt="logo" className="w-10 h-10 rounded-md bg-white object-contain p-1" />
            : <div className="w-10 h-10 rounded-md bg-emerald-500 flex items-center justify-center"><Building2 className="w-5 h-5 text-stone-900" /></div>}
          <div className="text-sm uppercase tracking-widest text-stone-300">{company_name}</div>
        </div>
        <div className="relative z-10 max-w-xl">
          <h1 className="text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Every project.<br />
            <span className="text-emerald-300">One quiet console.</span>
          </h1>
          <p className="mt-6 text-lg text-stone-300 max-w-md">
            Inventory, revenue, expenses & stock — governed by role, approved on paper trails, ready for the site office.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-6 max-w-lg">
            <Feature icon={<ShieldCheck className="w-5 h-5" />} title="2-Stage Approvals" body="Accounts → Management workflow with reasons on record." />
            <Feature icon={<LineChart className="w-5 h-5" />} title="Live Analytics" body="Sales velocity, revenue vs. target, expense trends." />
          </div>
        </div>
        <div className="relative z-10 text-xs text-stone-400">© {new Date().getFullYear()} {company_name} — internal build</div>
      </div>

      <div className="lg:col-span-2 flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-md">
          <div className="mb-8">
            <div className="text-xs uppercase tracking-widest text-stone-500">Sign in</div>
            <h2 className="mt-2 text-3xl font-bold text-stone-900">Welcome back</h2>
            <p className="mt-2 text-stone-600 text-sm">Use the email and temporary password shared by your administrator. You&apos;ll be asked to set a new password on first login.</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-500">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoFocus className="mt-1 h-11" data-testid="login-email-input" />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label className="text-xs uppercase tracking-widest text-stone-500">Password</label>
                <Link to="/forgot-password" className="text-xs text-emerald-800 hover:text-emerald-900 hover:underline" data-testid="forgot-password-link">Forgot password?</Link>
              </div>
              <div className="relative">
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? "text" : "password"} required className="mt-1 h-11 pr-10" data-testid="login-password-input" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-800">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={busy} className="w-full h-11 bg-emerald-900 hover:bg-emerald-800 text-white" data-testid="login-submit-btn">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </div>
          <div className="mt-6 rounded-lg border border-stone-200 bg-white p-4 text-xs text-stone-600">
            <div className="font-semibold text-stone-900 mb-1">First-time admins</div>
            System-seeded admin: <span className="font-mono">sales@agrocorp.co.in</span> — you&apos;ll be prompted to change the password immediately.
          </div>
        </form>
      </div>
    </div>
  );
}

function Feature({ icon, title, body }) {
  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 rounded-md bg-white/10 border border-white/10 flex items-center justify-center text-emerald-300">{icon}</div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-stone-300 mt-0.5">{body}</div>
      </div>
    </div>
  );
}
