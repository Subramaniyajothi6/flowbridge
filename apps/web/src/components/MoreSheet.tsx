import { BookOpen, LogOut, X, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { ROLE_LABELS, useAuth } from "../auth.tsx";
import { initials } from "../format.ts";

export type SheetLink = { to: string; label: string; icon: LucideIcon };

// On phones, the pages that do not fit in the bottom bar open from its "More" tab,
// as a sheet that slides up from the bottom (the pattern Apple, Facebook and Slack use).
export function MoreSheet({ links, onClose, onSignOut }: { links: SheetLink[]; onClose: () => void; onSignOut: () => void }) {
  const { session } = useAuth();

  // Escape closes it, and the page behind does not scroll while it is open.
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="more-scrim m-only" onClick={onClose}>
      <div className="more-sheet" role="dialog" aria-modal="true" aria-label="More pages" onClick={(event) => event.stopPropagation()}>
        <div className="more-grip" aria-hidden="true" />
        {session && (
          <div className="more-who">
            <span className="avatar">{initials(session.user.name)}</span>
            <div className="grow">
              <div className="strong trunc">{session.user.name}</div>
              <div className="small muted trunc">{ROLE_LABELS[session.user.role]}, {session.workspaceName}</div>
            </div>
            <button className="btn btn-g btn-ic" aria-label="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button>
          </div>
        )}

        <nav className="more-list" aria-label="More pages">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `more-item ${isActive ? "is-on" : ""}`} onClick={onClose}>
              <span className="more-ic"><Icon size={18} aria-hidden="true" /></span>
              {label}
            </NavLink>
          ))}
          <NavLink to="/docs" className="more-item" onClick={onClose}>
            <span className="more-ic"><BookOpen size={18} aria-hidden="true" /></span>
            Help and docs
          </NavLink>
        </nav>

        <button className="more-item more-out" onClick={onSignOut}>
          <span className="more-ic"><LogOut size={18} aria-hidden="true" /></span>
          Sign out
        </button>
      </div>
    </div>
  );
}
