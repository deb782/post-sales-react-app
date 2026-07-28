import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldCheck, Check, X } from "lucide-react";

function score(pw) {
  return {
    len: pw.length >= 10,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /\d/.test(pw),
    symbol: /[^\w\s]/.test(pw),
  };
}

export default function ResetPassword() {
  const { refresh, user } = useAuth();
  const nav = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const s = score(next);
  const allGood = Object.values(s).every(Boolean);
  const match = next && next === confirm;

  const submit = async (e) => {
    e.preventDefault();
    if (!allGood) return toast.error("Password does not meet requirements");
    if (!match) return toast.error("New password does not match confirmation");
    setBusy(true);
    try {
      await api.post("/auth/change-password", {
        current_password: current, new_password: next,
      });
      toast.success("Password updated");
      await refresh();
      nav("/dashboard", { replace: true });
    } catch (err) {
      toast.error(apiError(err, "Failed"));
    } finally { setBusy(false); }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-8">
      <form onSubmit={submit} className="w-full max-w-md bg-white border border-stone-200 rounded-xl p-8 shadow-sm" data-testid="reset-password-form">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-md bg-emerald-900 text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-stone-500">Security</div>
            <h1 className="text-xl font-bold text-stone-900">Set a new password</h1>
          </div>
        </div>
        <p className="text-sm text-stone-600 mb-5">
          Welcome, <b>{user.name}</b>. Please pick a permanent password before continuing.
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-stone-500">Temporary password</label>
            <Input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1 h-10" data-testid="current-password-input" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-stone-500">New password</label>
            <Input type="password" required value={next} onChange={(e) => setNext(e.target.value)} className="mt-1 h-10" data-testid="new-password-input" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-stone-500">Confirm new password</label>
            <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 h-10" data-testid="confirm-password-input" />
          </div>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <Rule ok={s.len} label="At least 10 characters" />
          <Rule ok={s.upper} label="An upper case letter" />
          <Rule ok={s.lower} label="A lower case letter" />
          <Rule ok={s.digit} label="A digit" />
          <Rule ok={s.symbol} label="A symbol" />
          <Rule ok={match} label="Matches confirmation" />
        </ul>
        <Button type="submit" disabled={busy} className="w-full mt-6 h-11 bg-emerald-900 hover:bg-emerald-800" data-testid="save-password-btn">
          {busy ? "Saving…" : "Save & continue"}
        </Button>
      </form>
    </div>
  );
}

function Rule({ ok, label }) {
  const Icon = ok ? Check : X;
  return (
    <li className={`flex items-center gap-1.5 ${ok ? "text-emerald-800" : "text-stone-500"}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </li>
  );
}
