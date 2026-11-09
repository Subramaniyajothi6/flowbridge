import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api.ts";
import { ROLE_LABELS, useAuth } from "../auth.tsx";
import { PageHead, Shell } from "../components/Shell.tsx";
import { initials } from "../format.ts";

const timezones = ["Asia/Kolkata", "Asia/Singapore", "Asia/Dubai", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "UTC"];

type Tab = "profile" | "password" | "workspace";
type Message = { text: string; isError: boolean };

function Feedback({ message }: { message: Message | null }) {
  return <div role="status">{message && <div className={`notice ${message.isError ? "err" : "ok"}`}>{message.text}</div>}</div>;
}

export function SettingsPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");

  const tabs: { id: Tab; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "password", label: "Password" },
    ...(can("settings.manage") ? [{ id: "workspace" as const, label: "Workspace" }] : []),
  ];

  return (
    <Shell>
      <div className="page">
        <PageHead title="Settings" subtitle="Your personal details and preferences." />
        <div className="tabs" role="tablist">
          {tabs.map((item) => (
            <button key={item.id} role="tab" aria-selected={tab === item.id} className={`tab ${tab === item.id ? "is-on" : ""}`} onClick={() => setTab(item.id)}>{item.label}</button>
          ))}
        </div>
        {tab === "profile" && <ProfileForm />}
        {tab === "password" && <PasswordForm />}
        {tab === "workspace" && <WorkspaceForm />}
      </div>
    </Shell>
  );
}

function ProfileForm() {
  const { session, refresh } = useAuth();
  const user = session?.user;
  const [name, setName] = useState(user?.name ?? "");
  const [timezone, setTimezone] = useState(user?.timezone ?? "UTC");
  const [message, setMessage] = useState<Message | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api.updateProfile({ name, timezone });
      await refresh();
      setMessage({ text: "Profile saved", isError: false });
    } catch (error) {
      setMessage({ text: (error as Error).message, isError: true });
    }
  }

  // The sidebar's sign out button is hidden on phones, so it is also here.
  async function signOut() {
    await api.signOut();
    window.location.assign("/sign-in");
  }

  if (!user) return null;

  return (
    <form className="card card-b col settings-form" onSubmit={submit}>
      <div className="row">
        <span className="avatar">{initials(user.name)}</span>
        <div>
          <div className="strong">{user.name}</div>
          <div className="small muted">{ROLE_LABELS[user.role]}</div>
        </div>
      </div>
      <Feedback message={message} />
      <div className="field">
        <label className="label" htmlFor="profile-name">Full name</label>
        <input id="profile-name" className="input" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="field">
        <label className="label" htmlFor="profile-email">Work email</label>
        <input id="profile-email" className="input" value={user.email} readOnly />
        <span className="hint">Ask an Administrator to change this.</span>
      </div>
      <div className="field">
        <label className="label" htmlFor="profile-timezone">Time zone</label>
        <select id="profile-timezone" className="select" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
          {timezones.map((zone) => <option key={zone}>{zone}</option>)}
        </select>
        <span className="hint">Run times are shown in this time zone.</span>
      </div>
      <div className="row">
        <button className="btn btn-p">Save profile</button>
        <button type="button" className="btn btn-g" onClick={signOut}>Sign out</button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const { refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<Message | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api.changePassword(currentPassword, newPassword);
      await refresh();
      setCurrentPassword("");
      setNewPassword("");
      setMessage({ text: "Password changed", isError: false });
    } catch (error) {
      setMessage({ text: (error as Error).message, isError: true });
    }
  }

  return (
    <form className="card card-b col settings-form" onSubmit={submit}>
      <Feedback message={message} />
      <div className="field">
        <label className="label" htmlFor="password-current">Current password</label>
        <input id="password-current" className="input" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
      </div>
      <div className="field">
        <label className="label" htmlFor="password-new">New password</label>
        <input id="password-new" className="input" type="password" autoComplete="new-password" required minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        <span className="hint">At least 12 characters.</span>
      </div>
      <div className="row"><button className="btn btn-p">Change password</button></div>
    </form>
  );
}

function WorkspaceForm() {
  const { refresh } = useAuth();
  const [name, setName] = useState("");
  const [monthlyRunLimit, setMonthlyRunLimit] = useState(0);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    api.getWorkspace().then((row) => {
      setName(row.name);
      setMonthlyRunLimit(row.monthlyRunLimit);
    }).catch((error: Error) => setMessage({ text: error.message, isError: true }));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api.updateWorkspace({ name, monthlyRunLimit });
      await refresh();
      setMessage({ text: "Workspace saved", isError: false });
    } catch (error) {
      setMessage({ text: (error as Error).message, isError: true });
    }
  }

  return (
    <form className="card card-b col settings-form" onSubmit={submit}>
      <Feedback message={message} />
      <div className="field">
        <label className="label" htmlFor="workspace-name">Workspace name</label>
        <input id="workspace-name" className="input" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="field">
        <label className="label" htmlFor="workspace-limit">Live runs allowed each month</label>
        <input id="workspace-limit" className="input" type="number" min={1} required value={monthlyRunLimit} onChange={(event) => setMonthlyRunLimit(Number(event.target.value))} />
        <span className="hint">New live runs are refused once this is reached. Test runs do not count.</span>
      </div>
      <div className="row"><button className="btn btn-p">Save workspace</button></div>
    </form>
  );
}
