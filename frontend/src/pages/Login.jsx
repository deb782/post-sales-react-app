import { useAuth } from "@/lib/auth";
import { Building2, ShieldCheck, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  const signIn = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-5 bg-stone-50">
      {/* Left visual pane */}
      <div className="hidden lg:flex lg:col-span-3 relative bg-stone-900 text-white p-12 flex-col justify-between overflow-hidden grain">
        <div className="absolute inset-0 opacity-30 pointer-events-none"
             style={{ backgroundImage: "url('https://images.pexels.com/photos/20273065/pexels-photo-20273065.jpeg')", backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="absolute inset-0 bg-gradient-to-tr from-stone-950 via-stone-900/70 to-transparent" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-emerald-500 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-stone-900" />
          </div>
          <div className="text-sm uppercase tracking-widest text-stone-300">Estate OS</div>
        </div>
        <div className="relative z-10 max-w-xl">
          <h1 className="text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Every project. <br />
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
        <div className="relative z-10 text-xs text-stone-400">© {new Date().getFullYear()} Estate OS — internal build</div>
      </div>

      {/* Right auth pane */}
      <div className="lg:col-span-2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="text-xs uppercase tracking-widest text-stone-500">Sign in</div>
            <h2 className="mt-2 text-3xl font-bold text-stone-900">Welcome back</h2>
            <p className="mt-2 text-stone-600 text-sm">Continue with your Google account. Your admin decides your access.</p>
          </div>
          <Button
            data-testid="google-signin-btn"
            onClick={signIn}
            className="w-full h-12 bg-emerald-900 hover:bg-emerald-800 text-white text-base"
          >
            <GoogleGlyph /> Continue with Google
          </Button>

          <div className="mt-8 rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
            <div className="font-semibold text-stone-900 mb-1">First time?</div>
            The very first sign-in becomes the <span className="font-medium text-emerald-800">Admin</span>. Additional users must be pre-added by an admin.
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, body }) {
  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 rounded-md bg-white/10 border border-white/10 flex items-center justify-center text-emerald-300">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-stone-300 mt-0.5">{body}</div>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.8 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 2.9l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.6-8 19.6-20 0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 2.9l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.4 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.1 35.4 26.7 36 24 36c-5.3 0-9.7-3.2-11.3-7.7l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C41.1 35.5 44 30.3 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  );
}
