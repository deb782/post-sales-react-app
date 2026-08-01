import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { BrandingProvider } from "@/lib/branding";
import { OnboardingProvider } from "@/lib/onboarding";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import Onboarding from "@/pages/Onboarding";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import Units from "@/pages/Units";
import Revenue from "@/pages/Revenue";
import Expenses from "@/pages/Expenses";
import Stock from "@/pages/Stock";
import Users from "@/pages/Users";
import Settings from "@/pages/Settings";
import AuditLog from "@/pages/AuditLog";
import ImportExcel from "@/pages/ImportExcel";
import Sales from "@/pages/Sales";
import CRM from "@/pages/CRM";
import Tickets from "@/pages/Tickets";

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-stone-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_reset_password && !window.location.pathname.startsWith("/reset-password")) {
    return <Navigate to="/reset-password" replace />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function OnboardGate({ children }) {
  const { user } = useAuth();
  // Only admin passes through the onboarding wizard once
  if (user.role === "admin" && !user.onboarding_completed) {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}

function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<Protected><ResetPassword /></Protected>} />
      <Route path="/onboarding" element={<Protected roles={["admin"]}><Onboarding /></Protected>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<Protected><OnboardGate><Layout /></OnboardGate></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/units" element={<Units />} />
        <Route path="/sales" element={<Protected roles={["admin","management","sales"]}><Sales /></Protected>} />
        <Route path="/crm" element={<Protected roles={["admin","management","crm","accounts"]}><CRM /></Protected>} />
        <Route path="/crm/:unitId" element={<Protected roles={["admin","management","crm","accounts"]}><CRM /></Protected>} />
        <Route path="/revenue" element={<Protected roles={["admin","accounts","management"]}><Revenue /></Protected>} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/tickets" element={<Protected roles={["admin","management","site_manager"]}><Tickets /></Protected>} />
        <Route path="/users" element={<Protected roles={["admin"]}><Users /></Protected>} />
        <Route path="/import" element={<Protected roles={["admin","management"]}><ImportExcel /></Protected>} />
        <Route path="/audit" element={<Protected roles={["admin"]}><AuditLog /></Protected>} />
        <Route path="/settings" element={<Protected roles={["admin","management"]}><Settings /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrandingProvider>
      <AuthProvider>
        <OnboardingProvider>
          <BrowserRouter>
            <AppRouter />
            <Toaster position="top-right" richColors />
          </BrowserRouter>
        </OnboardingProvider>
      </AuthProvider>
    </BrandingProvider>
  );
}
