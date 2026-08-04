import { NavLink, Outlet } from "react-router-dom";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import { useBranding } from "@/lib/branding";
import {
  LayoutDashboard, Building2, Home, Wallet, Receipt, Boxes,
  Users as UsersIcon, Upload, Settings as SettingsIcon,
  ScrollText, LogOut, TicketCheck, HandCoins, Handshake,
} from "lucide-react";
import NotificationsBell from "@/components/NotificationsBell";
import GlobalSearch from "@/components/GlobalSearch";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["super_admin","process_admin","crm_head","sales_head","accounts_head","sales_rep","post_sales_rep","accounts_rep","site_supervisor"] },
  { to: "/projects", label: "Projects", icon: Building2, roles: ["super_admin","process_admin","crm_head","sales_head","accounts_head","sales_rep","post_sales_rep","accounts_rep","site_supervisor"] },
  { to: "/units", label: "Inventory", icon: Home, roles: ["super_admin","process_admin","crm_head","sales_head","accounts_head","sales_rep","post_sales_rep","accounts_rep","site_supervisor"] },
  { to: "/sales", label: "Sales", icon: Handshake, roles: ["super_admin","process_admin","sales_head","sales_rep"] },
  { to: "/sales-approvals", label: "Sales Approvals", icon: TicketCheck, roles: ["super_admin","sales_head"] },
  { to: "/crm", label: "CRM & Payments", icon: HandCoins, roles: ["super_admin","process_admin","crm_head","post_sales_rep","accounts_head","accounts_rep"] },
  { to: "/revenue", label: "Revenue", icon: Wallet, roles: ["super_admin","process_admin","accounts_head","accounts_rep","crm_head"] },
  { to: "/expenses", label: "Expenses", icon: Receipt, roles: ["super_admin","process_admin","crm_head","accounts_head","accounts_rep","site_supervisor"] },
  { to: "/stock", label: "Stock Book", icon: Boxes, roles: ["super_admin","process_admin","crm_head","site_supervisor"] },
  { to: "/tickets", label: "Tickets", icon: TicketCheck, roles: ["super_admin","process_admin","crm_head","site_supervisor"] },
  { to: "/users", label: "Users", icon: UsersIcon, roles: ["super_admin","process_admin"] },
  { to: "/import", label: "Excel Import", icon: Upload, roles: ["super_admin","process_admin"] },
  { to: "/audit", label: "Audit Log", icon: ScrollText, roles: ["super_admin"] },
  { to: "/settings", label: "Settings", icon: SettingsIcon, roles: ["super_admin","process_admin"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { company_name, logo_url } = useBranding();

  const visible = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="min-h-screen flex bg-stone-50">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-stone-900 text-white flex flex-col sticky top-0 h-screen">
        <div className="p-5 flex items-center gap-3 border-b border-stone-800">
          {logo_url ? (
            <img src={logo_url} alt="logo" className="w-9 h-9 rounded-md bg-white object-contain p-0.5" />
          ) : (
            <div className="w-9 h-9 rounded-md bg-emerald-500 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-stone-900" />
            </div>
          )}
          <div>
            <div className="font-semibold tracking-tight">{company_name}</div>
            <div className="text-[10px] uppercase tracking-widest text-stone-400">Stakeholder Console</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {visible.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g,"-")}`}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-stone-800">
          <NavLink
            to="/profile"
            data-testid="nav-profile"
            className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-stone-800 transition-colors"
          >
            {user.picture ? (
              <img src={user.picture.startsWith("/api")
                ? `${process.env.REACT_APP_BACKEND_URL}${user.picture}`
                : user.picture}
                alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-emerald-800 flex items-center justify-center text-sm font-semibold">
                {user.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{user.name}</div>
              <div className="text-[11px] text-stone-400">{ROLE_LABELS[user.role]}</div>
            </div>
          </NavLink>
          <button
            data-testid="logout-btn"
            onClick={logout}
            className="mt-2 w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-stone-300 hover:bg-stone-800 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 border-b border-stone-200/50 px-8 py-4 flex items-center gap-4">
          <div className="flex-1"><GlobalSearch /></div>
          <NotificationsBell />
        </header>
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
