import { BarChart3, BookOpen, History, LayoutDashboard, LayoutGrid, ListChecks, LogOut, Menu, Plug, Settings, Users, Workflow } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { api } from "../api.ts";
import { ROLE_LABELS, useAuth } from "../auth.tsx";
import { formatNumber, initials } from "../format.ts";
import { useLoad } from "../useLoad.ts";
import { AccountMenu } from "./AccountMenu.tsx";
import { DesignIcon } from "./DesignIcon.tsx";
import { MoreSheet } from "./MoreSheet.tsx";
import { NotificationBell } from "./NotificationBell.tsx";

// On phones the sidebar becomes a bar along the bottom: the four pages marked "phone", plus a More tab.
// More opens a sheet with every other page, so nothing is out of reach (Material and Apple guidance:
// at most five items in a bottom bar, the rest behind "More").
const links = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard, phone: true },
  { to: "/workflows", label: "Workflows", icon: Workflow, phone: true },
  { to: "/templates", label: "Templates", icon: LayoutGrid, permission: "workflows.edit", phone: false },
  { to: "/integrations", label: "Integrations", icon: Plug, permission: "integrations.view", phone: false },
  { to: "/executions", label: "Executions", icon: History, phone: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3, phone: true },
  { to: "/team", label: "Team", icon: Users, permission: "members.manage", phone: false },
  { to: "/settings", label: "Settings", icon: Settings, phone: false },
];

// Activity has no sidebar link on a computer, but on a phone it is one tap away in More.
const MORE_ONLY = [{ to: "/activity", label: "Activity", icon: ListChecks, permission: "runs.view" }];

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

// The sidebar's collapsed or open state is remembered in this browser only.
// Reading and writing are wrapped, because some browsers block storage.
const SIDEBAR_KEY = "fb-side";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

function saveCollapsed(isCollapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_KEY, isCollapsed ? "1" : "0");
  } catch {
    // Not remembered, but the sidebar still works.
  }
}

export function Shell({ children }: { children: ReactNode }) {
  const { session, can } = useAuth();
  const { pathname } = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const closeMore = useCallback(() => setIsMoreOpen(false), []);

  function toggleSidebar() {
    saveCollapsed(!isCollapsed);
    setIsCollapsed(!isCollapsed);
  }
  // Reloads on every page change, so the numbers do not go stale.
  const usage = useLoad(api.usage, [pathname]);

  // Activity has no sidebar link, so it is named here.
  const section = links.find((link) => pathname.startsWith(link.to))?.label ?? (pathname.startsWith("/activity") ? "Activity" : "FlowBridge");
  const needsAttention = usage.data?.needsAttention ?? 0;
  const usedShare = usage.data && usage.data.limit > 0 ? Math.min(100, (usage.data.used / usage.data.limit) * 100) : 0;

  async function signOut() {
    await api.signOut();
    window.location.assign("/sign-in");
  }

  const allowed = links.filter((link) => !link.permission || can(link.permission));
  const morePages = [...allowed.filter((link) => !link.phone), ...MORE_ONLY.filter((link) => can(link.permission))];
  // The More tab lights up when the page shown is one of the pages inside it.
  const isOnMorePage = morePages.some((link) => pathname.startsWith(link.to)) || pathname.startsWith("/docs");

  return (
    <div className="app">
      <nav className={`side ${isCollapsed ? "is-col" : ""}`} aria-label="Main">
        <NavLink className="side-brand" to="/overview" aria-label="FlowBridge overview">
          <BrandMark />
          <span className="side-word">FlowBridge</span>
        </NavLink>
        {allowed.map(({ to, label, icon: Icon, phone }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav tip ${isActive ? "is-on" : ""} ${phone ? "" : "m-hide"}`} data-tip={label} aria-label={label}>
            <Icon size={17} aria-hidden="true" />
            <span className="nav-label">{label}</span>
            {to === "/executions" && needsAttention > 0 && <span className="nav-count">{needsAttention}</span>}
          </NavLink>
        ))}
        <button className={`nav m-only ${isOnMorePage || isMoreOpen ? "is-on" : ""}`} aria-label="More pages" aria-expanded={isMoreOpen} onClick={() => setIsMoreOpen(true)}>
          <Menu size={17} aria-hidden="true" />
          <span className="nav-label">More</span>
        </button>
        <div className="side-gap" />
        <NavLink className="nav tip m-hide" to="/docs" data-tip="Help and support" aria-label="Help and support">
          <BookOpen size={17} aria-hidden="true" />
          <span className="nav-label">Help and support</span>
        </NavLink>
        <button className="nav tip side-collapse m-hide" data-tip="Expand sidebar" aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!isCollapsed} onClick={toggleSidebar}>
          <DesignIcon name="panel" size={17} />
          <span className="nav-label">Collapse</span>
        </button>
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
          {/* The workspace's run allowance matters to the people who build and run its automations, not to every user. */}
          {usage.data && can("workflows.edit") && (
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

      {isMoreOpen && <MoreSheet links={morePages} onClose={closeMore} onSignOut={signOut} />}
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
