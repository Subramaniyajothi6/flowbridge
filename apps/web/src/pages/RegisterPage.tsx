import { Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { BrandMark } from "../components/Shell.tsx";

const exampleSteps = ["Customer registers", "Details are validated", "Customer is saved", "Welcome email is sent", "Sales team is notified"];

export function RegisterPage() {
  const { status, session, acceptSession } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", organisation: "", password: "" });
  const [problem, setProblem] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  if (session) return <Navigate to="/overview" replace />;
  const isClosed = status?.workspaceExists === true;

  const update = (field: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsSending(true);
    setProblem(null);
    try {
      acceptSession(await api.register(form));
      navigate("/overview", { replace: true });
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="reg-page">
      <main className="reg-main">
        <Link className="row si-brand reg-brand" to="/" aria-label="FlowBridge home"><BrandMark /> FlowBridge</Link>
        <div className="reg-body">
          {isClosed ? (
            <>
              <div>
                <h1 className="page-title si-title">This workspace is already set up</h1>
                <p className="page-sub">Ask your Administrator to add you, and they will give you a password to sign in with.</p>
              </div>
              <Link className="btn btn-p si-submit" to="/sign-in">Go to Sign in</Link>
            </>
          ) : (
            <>
              <div>
                <h1 className="page-title si-title">Create your workspace</h1>
                <p className="page-sub">Connect your apps and automate your first process today.</p>
              </div>
              <form className="col" style={{ gap: 16 }} onSubmit={submit}>
                <div className="field">
                  <label className="label" htmlFor="reg-name">Full name</label>
                  <input id="reg-name" className="input si-input" autoComplete="name" required value={form.name} onChange={update("name")} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="reg-email">Work email</label>
                  <input id="reg-email" className="input si-input" type="email" autoComplete="email" required value={form.email} onChange={update("email")} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="reg-org">Organisation</label>
                  <input id="reg-org" className="input si-input" autoComplete="organization" required value={form.organisation} onChange={update("organisation")} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="reg-password">Password</label>
                  <input id="reg-password" className="input si-input" type="password" autoComplete="new-password" required minLength={12} value={form.password} onChange={update("password")} />
                  <span className="hint">At least 12 characters.</span>
                </div>
                {problem && <div className="notice err" role="alert">{problem}</div>}
                <button className="btn btn-p si-submit" disabled={isSending}>{isSending ? "Creating..." : "Create workspace"}</button>
              </form>
              <p className="small muted">Already have an account? <Link to="/sign-in">Sign in</Link></p>
            </>
          )}
        </div>
      </main>
      <aside className="reg-side si-bg hide-m">
        <h2>Automate the process. See every step it takes.</h2>
        <div className="col" style={{ gap: 0 }}>
          {exampleSteps.map((step) => (
            <div className="row reg-step" key={step}>
              <span className="tl-n ok"><Check size={12} aria-hidden="true" /></span>
              <span className="grow">{step}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
