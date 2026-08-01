import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { useBranding } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, MailCheck, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPassword() {
  const { company_name, logo_url } = useBranding();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="hidden md:flex md:w-1/2 bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-950 p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.15) 0%, transparent 55%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.08) 0%, transparent 55%)" }} />
        <div className="relative z-10 flex flex-col justify-between w-full">
          <div className="flex items-center gap-3">
            {logo_url && <img src={logo_url} alt="" className="h-10 w-10 rounded-md object-contain bg-white/10 p-1" />}
            <div className="text-lg font-semibold uppercase tracking-widest">{company_name}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-emerald-300">Account recovery</div>
            <h2 className="text-4xl font-bold mt-2 leading-tight">Locked out?<br />We&apos;ve got you.</h2>
            <p className="mt-4 text-stone-300 text-sm max-w-md leading-relaxed">
              Enter the email you use to log in. If we recognize it, we&apos;ll send you a fresh temporary password in seconds. You&apos;ll be prompted to set a new one the moment you sign back in.
            </p>
          </div>
          <div className="text-xs text-stone-400">
            © {new Date().getFullYear()} {company_name}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center p-6 md:p-12 bg-stone-50">
        <div className="w-full max-w-md">
          <Link to="/login" className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 mb-8" data-testid="back-to-login-link">
            <ArrowLeft className="w-3 h-3" /> Back to sign in
          </Link>

          {!sent ? (
            <form onSubmit={submit} data-testid="forgot-form">
              <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center mb-5">
                <KeyRound className="w-5 h-5 text-emerald-900" />
              </div>
              <h1 className="text-3xl font-bold text-stone-900">Reset your password</h1>
              <p className="mt-2 text-sm text-stone-500">
                Enter your work email. If an account exists, we&apos;ll email you a temporary password.
              </p>

              <div className="mt-8 space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-500">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 h-11"
                    placeholder="you@company.com"
                    autoFocus
                    required
                    data-testid="forgot-email-input"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busy || !email}
                  className="w-full h-11 bg-emerald-900 hover:bg-emerald-800 text-white"
                  data-testid="forgot-submit-btn"
                >
                  {busy ? "Sending…" : "Send temporary password"}
                </Button>
              </div>

              <div className="mt-8 rounded-lg border border-stone-200 bg-white p-4 text-xs text-stone-600">
                <div className="font-semibold text-stone-900 mb-1">Security note</div>
                For safety, we don&apos;t reveal whether an email is registered. Check your inbox — if you don&apos;t receive the email in ~2 minutes, contact your admin.
              </div>
            </form>
          ) : (
            <div data-testid="forgot-sent">
              <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center mb-5">
                <MailCheck className="w-5 h-5 text-emerald-900" />
              </div>
              <h1 className="text-3xl font-bold text-stone-900">Check your inbox</h1>
              <p className="mt-2 text-sm text-stone-500">
                If <span className="font-mono text-stone-800">{email}</span> matches an account, a fresh temporary password is on its way. It usually arrives within a minute.
              </p>
              <ol className="mt-6 space-y-3 text-sm text-stone-700">
                <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-xs font-semibold shrink-0">1</span> Open the email and copy the temporary password.</li>
                <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-xs font-semibold shrink-0">2</span> Sign in with your email + the temporary password.</li>
                <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-xs font-semibold shrink-0">3</span> You&apos;ll be prompted to set a new password immediately.</li>
              </ol>
              <div className="mt-8 flex gap-3">
                <Button onClick={() => nav("/login")} className="bg-emerald-900 hover:bg-emerald-800" data-testid="back-to-signin-btn">Back to sign in</Button>
                <Button variant="outline" onClick={() => { setSent(false); setEmail(""); }} data-testid="try-another-email-btn">Try a different email</Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
