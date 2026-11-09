import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api.ts";
import { ROLE_LABELS, useAuth } from "../auth.tsx";

export function NoAccessPage() {
  const { session } = useAuth();

  async function useAnotherAccount() {
    await api.signOut();
    window.location.assign("/sign-in");
  }

  return (
    <main className="no-access">
      <div className="card col no-access-card">
        <div className="empty-ic"><Lock size={20} aria-hidden="true" /></div>
        <div>
          <h1 className="page-title">Your role can't open this page</h1>
          {session && <p className="page-sub">You are signed in as {session.user.name}, {ROLE_LABELS[session.user.role]}. Ask an Administrator if you need access.</p>}
        </div>
        <div className="row wrap">
          <Link className="btn btn-p" to="/overview">Back to Overview</Link>
          <button className="btn" onClick={useAnotherAccount}>Use another account</button>
        </div>
      </div>
    </main>
  );
}
