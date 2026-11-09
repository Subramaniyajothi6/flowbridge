import { History, Workflow, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/workflows", label: "Workflows", icon: Workflow },
  { to: "/executions", label: "Executions", icon: History },
  { to: "/integrations", label: "Integrations", icon: Wrench },
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
  return (
    <div className="app">
      <nav className="side" aria-label="Main">
        <NavLink className="side-brand" to="/workflows" aria-label="FlowBridge workflows">
          <BrandMark />
          <span className="side-word">FlowBridge</span>
        </NavLink>
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav tip ${isActive ? "is-on" : ""}`} data-tip={label} aria-label={label}>
            <Icon size={17} aria-hidden="true" />
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="main">{children}</div>
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
