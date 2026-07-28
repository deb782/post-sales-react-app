import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { BrandingProvider } from "@/lib/branding";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
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

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-stone-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/units" element={<Units />} />
        <Route path="/revenue" element={<Protected roles={["admin","accounts","management"]}><Revenue /></Protected>} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/users" element={<Protected roles={["admin"]}><Users /></Protected>} />
        <Route path="/import" element={<Protected roles={["admin"]}><ImportExcel /></Protected>} />
        <Route path="/audit" element={<Protected roles={["admin"]}><AuditLog /></Protected>} />
        <Route path="/settings" element={<Protected roles={["admin"]}><Settings /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrandingProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </BrandingProvider>
  );
}
