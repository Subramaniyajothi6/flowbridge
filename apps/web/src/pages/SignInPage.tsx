import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { BrandMark } from "../components/Shell.tsx";

export function SignInPage() {
  const { status, session, acceptSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  if (session) return <Navigate to="/overview" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsSending(true);
    setProblem(null);
    try {
      acceptSession(await api.signIn(email, password));
      navigate("/overview", { replace: true });
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="si-page si-bg">
      <Link className="row si-brand" to="/" aria-label="FlowBridge home"><BrandMark /> FlowBridge</Link>
      <main className="card col si-card">
        <div>
          <h1 className="page-title si-title">Sign in</h1>
          <p className="page-sub">Welcome back to your workspace.</p>
        </div>
        <form className="col" style={{ gap: 16 }} onSubmit={submit}>
          <div className="field">
            <label className="label" htmlFor="sign-in-email">Work email</label>
            <input id="sign-in-email" className="input si-input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="sign-in-password">Password</label>
            <input id="sign-in-password" className="input si-input" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {problem && <div className="notice err" role="alert">{problem}</div>}
          <button className="btn btn-p si-submit" disabled={isSending}>{isSending ? "Signing in..." : "Sign in"}</button>
        </form>
        {status?.workspaceExists === false ? (
          <p className="small muted">New to FlowBridge? <Link to="/register">Get started</Link></p>
        ) : (
          <p className="small muted">Need an account? Ask your Administrator to add you.</p>
        )}
      </main>
    </div>
  );
}
