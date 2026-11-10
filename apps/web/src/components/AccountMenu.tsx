import { BookOpen, LogOut, Settings } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.ts";
import { ROLE_LABELS, useAuth } from "../auth.tsx";
import { initials } from "../format.ts";
import { useDismiss } from "./useDismiss.ts";

// The round avatar at the top right. On phones the sidebar's sign-out button is hidden,
// so this is the one place that always works.
export function AccountMenu() {
  const { session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  useDismiss(container, isOpen, close);

  if (!session) return null;
  const { user } = session;

  async function signOut() {
    await api.signOut();
    window.location.assign("/sign-in");
  }

  return (
    <div className="bell-wrap" ref={container}>
      <button className="avatar top-avatar" aria-label="Account menu" aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)}>
        {initials(user.name)}
      </button>

      {isOpen && (
        <div className="pop account-pop">
          <div className="account-head">
            <div className="strong trunc">{user.name}</div>
            <div className="small muted trunc">{user.email}</div>
            <div className="small muted">{ROLE_LABELS[user.role]}, {session.workspaceName}</div>
          </div>
          <div className="menu-sep" />
          <Link className="menu-i" to="/settings" onClick={close}><Settings size={15} aria-hidden="true" /> Settings</Link>
          <Link className="menu-i" to="/docs" onClick={close}><BookOpen size={15} aria-hidden="true" /> Help and docs</Link>
          <div className="menu-sep" />
          <button className="menu-i" onClick={signOut}><LogOut size={15} aria-hidden="true" /> Sign out</button>
        </div>
      )}
    </div>
  );
}
