import { BarChart3, BookOpen, History, LayoutDashboard, LayoutGrid, LogOut, Plug, Settings, Users, Workflow } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { api } from "../api.ts";
import { ROLE_LABELS, useAuth } from "../auth.tsx";
import { formatNumber, initials } from "../format.ts";
import { useLoad } from "../useLoad.ts";
import { AccountMenu } from "./AccountMenu.tsx";
import { NotificationBell } from "./NotificationBell.tsx";

const links = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/workflows", label: "Workflows", icon: Workflow },
  { to: "/templates", label: "Templates", icon: LayoutGrid, permission: "workflows.edit" },
  { to: "/integrations", label: "Integrations", icon: Plug, permission: "integrations.view" },
  { to: "/executions", label: "Executions", icon: History },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/team", label: "Team", icon: Users, permission: "members.manage" },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function BrandMark() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" width="28" height="28" style={{ flex: "none" }}>
      <rect width="28" height="28" rx="7" fill="#C94C0A" />
      <path d="M6.5 18.5C9 9.5 19 9.5 21.5 18.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="6.5" cy="19" r="2.6" fill="#fff" />
      <circle cx="21.5" cy="19" r="2.6" fill="#fff" />
    </svg>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { session, can } = useAuth();
  const { pathname } = useLocation();
  // Reloads on every page change, so the numbers do not go stale.
  const usage = useLoad(api.usage, [pathname]);

  const section = links.find((link) => pathname.startsWith(link.to))?.label ?? "FlowBridge";
  const needsAttention = usage.data?.needsAttention ?? 0;
  const usedShare = usage.data && usage.data.limit > 0 ? Math.min(100, (usage.data.used / usage.data.limit) * 100) : 0;

  async function signOut() {
    await api.signOut();
    window.location.assign("/sign-in");
  }

  return (
    <div className="app">
      <nav className="side" aria-label="Main">
        <NavLink className="side-brand" to="/overview" aria-label="FlowBridge overview">
          <BrandMark />
          <span className="side-word">FlowBridge</span>
        </NavLink>
        {links.filter((link) => !link.permission || can(link.permission)).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav tip ${isActive ? "is-on" : ""}`} data-tip={label} aria-label={label}>
            <Icon size={17} aria-hidden="true" />
            <span className="nav-label">{label}</span>
            {to === "/executions" && needsAttention > 0 && <span className="nav-count">{needsAttention}</span>}
          </NavLink>
        ))}
        <div className="side-gap" />
        <NavLink className="nav tip m-hide" to="/docs" data-tip="Help and support" aria-label="Help and support">
          <BookOpen size={17} aria-hidden="true" />
          <span className="nav-label">Help and support</span>
        </NavLink>
        {session && (
          <div className="user">
            <span className="avatar">{initials(session.user.name)}</span>
            <div className="user-meta grow">
              <div className="strong trunc">{session.user.name}</div>
              <div className="small dim trunc">{ROLE_LABELS[session.user.role]}</div>
            </div>
            <button className="btn btn-g btn-ic btn-sm user-out" aria-label="Sign out" title="Sign out" onClick={signOut}>
              <LogOut size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </nav>

      <div className="main">
        <header className="top">
          <nav className="crumbs" aria-label="Current page"><b className="trunc">{section}</b></nav>
          <div className="grow" />
          {usage.data && (
            <div className="row small hide-m" title="Live runs this month. Test runs do not count.">
              <span className="hbar top-usage"><i style={{ width: `${usedShare}%` }} /></span>
              <span className="num muted">{formatNumber(usage.data.used)} of {formatNumber(usage.data.limit)} runs</span>
            </div>
          )}
          {session && <span className="role-chip hide-m">{ROLE_LABELS[session.user.role]}</span>}
          <NotificationBell />
          <AccountMenu />
        </header>

        {session?.user.mustChangePassword && pathname !== "/settings" && (
          <div className="notice warn top-notice">
            You are using a temporary password. <Link to="/settings">Choose your own in Settings.</Link>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function PageHead({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {children && <div className="row wrap">{children}</div>}
    </div>
  );
}
