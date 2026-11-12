import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api.ts";
import { ROLE_LABELS, useAuth } from "../auth.tsx";
import { PageHead, Shell } from "../components/Shell.tsx";
import { formatNumber, initials } from "../format.ts";
import type { NotificationPreference, Workspace } from "../types.ts";
import { useLoad } from "../useLoad.ts";
import { ActivityLog } from "./ActivityPage.tsx";

const timezones = ["Asia/Kolkata", "Asia/Singapore", "Asia/Dubai", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "UTC"];

type Tab = "profile" | "password" | "notifications" | "workspace" | "activity";
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
    { id: "notifications", label: "Notifications" },
    ...(can("settings.manage") ? [{ id: "workspace" as const, label: "Workspace" }] : []),
    ...(can("runs.view") ? [{ id: "activity" as const, label: "Activity" }] : []),
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
        {tab === "notifications" && <NotificationSettingsCard />}
        {tab === "workspace" && <WorkspaceForm />}
        {tab === "activity" && <ActivityLog />}
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

// Each switch saves straight away, so there is no Save button.
function NotificationSettingsCard() {
  const { data, error, reload } = useLoad(api.notificationSettings);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function change(preference: NotificationPreference, channel: "email" | "inApp") {
    const next = { event: preference.event, email: preference.email, inApp: preference.inApp, [channel]: !preference[channel] };
    setSaving(`${preference.event}:${channel}`);
    setProblem(null);
    try {
      await api.saveNotificationSetting(next);
      await reload();
    } catch (failure) {
      setProblem((failure as Error).message);
    } finally {
      setSaving(null);
    }
  }

  if (error) return <div className="notice err">{error}</div>;
  if (!data) return <span className="skel" />;

  return (
    <div className="col settings-stack">
      <p className="muted">Choose what reaches you, and where. Emails are sent from the workspace's connected Gmail account to {data.emailAddress}.</p>
      {!data.canReceiveEmail && (
        <div className="notice warn">{data.emailAddress} cannot receive email, so only In app notifications will reach you. Ask an Administrator to change your email address on the Team page.</div>
      )}
      {problem && <div className="notice err" role="alert">{problem}</div>}

      <section className="card notify-card" aria-label="Notifications">
        {data.events.map((preference) => (
          <div className="notify-row" key={preference.event}>
            <div className="grow">
              <div className="strong">{preference.label}</div>
              <div className="small muted">{preference.description}</div>
            </div>
            <div className="row notify-switches">
              {(["email", "inApp"] as const).map((channel) => {
                const label = channel === "email" ? "Email" : "In app";
                return (
                  <label className="row small muted notify-switch" key={channel}>
                    {label}
                    <button
                      type="button"
                      className={`toggle ${preference[channel] ? "is-on" : ""}`}
                      role="switch"
                      aria-checked={preference[channel]}
                      aria-label={`${label} for ${preference.label}`}
                      disabled={saving !== null}
                      onClick={() => change(preference, channel)}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

const HISTORY_CHOICES = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 180, label: "180 days" },
  { days: 365, label: "1 year" },
  { days: 0, label: "Keep forever" },
];

// "Try up to 3 times" means the first try and two retries.
const RETRY_CHOICES = [
  { attempts: 1, label: "Do not retry" },
  { attempts: 2, label: "Try up to 2 times, then stop the run" },
  { attempts: 3, label: "Try up to 3 times, then stop the run" },
  { attempts: 4, label: "Try up to 4 times, then stop the run" },
  { attempts: 5, label: "Try up to 5 times, then stop the run" },
];

function WorkspaceForm() {
  const { refresh } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [name, setName] = useState("");
  const [monthlyRunLimit, setMonthlyRunLimit] = useState(0);
  const [runHistoryDays, setRunHistoryDays] = useState(90);
  const [stepRetryAttempts, setStepRetryAttempts] = useState(3);
  const [message, setMessage] = useState<Message | null>(null);

  async function load() {
    const row = await api.getWorkspace();
    setWorkspace(row);
    setName(row.name);
    setMonthlyRunLimit(row.monthlyRunLimit);
    setRunHistoryDays(row.runHistoryDays);
    setStepRetryAttempts(row.stepRetryAttempts);
  }

  useEffect(() => {
    load().catch((error: Error) => setMessage({ text: error.message, isError: true }));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api.updateWorkspace({ name, monthlyRunLimit, runHistoryDays, stepRetryAttempts });
      await refresh();
      await load();
      setMessage({ text: "Workspace saved", isError: false });
    } catch (error) {
      setMessage({ text: (error as Error).message, isError: true });
    }
  }

  const usedShare = workspace && workspace.monthlyRunLimit > 0 ? Math.min(100, (workspace.used / workspace.monthlyRunLimit) * 100) : 0;
  const resetsOn = workspace ? new Date(workspace.resetsAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";

  return (
    <div className="col settings-stack">
      <form className="card card-b col settings-form" onSubmit={submit}>
        <Feedback message={message} />
        <div className="field">
          <label className="label" htmlFor="workspace-name">Workspace name</label>
          <input id="workspace-name" className="input" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="workspace-history">Keep run history for</label>
          <select id="workspace-history" className="select" value={runHistoryDays} onChange={(event) => setRunHistoryDays(Number(event.target.value))}>
            {HISTORY_CHOICES.map((choice) => <option key={choice.days} value={choice.days}>{choice.label}</option>)}
          </select>
          <span className="hint">After this, the data each run received and sent is deleted. The runs stay listed, and their figures stay in Analytics.</span>
        </div>
        <div className="field">
          <label className="label" htmlFor="workspace-retries">Default retries for new steps</label>
          <select id="workspace-retries" className="select" value={stepRetryAttempts} onChange={(event) => setStepRetryAttempts(Number(event.target.value))}>
            {RETRY_CHOICES.map((choice) => <option key={choice.attempts} value={choice.attempts}>{choice.label}</option>)}
          </select>
          <span className="hint">Used for new HTTP, app and loop steps. Each step can still be changed in the builder.</span>
        </div>
        <div className="field">
          <label className="label" htmlFor="workspace-limit">Live runs allowed each month</label>
          <input id="workspace-limit" className="input" type="number" min={1} required value={monthlyRunLimit} onChange={(event) => setMonthlyRunLimit(Number(event.target.value))} />
          <span className="hint">New live runs are refused once this is reached. Test runs do not count.</span>
        </div>
        <div className="row"><button className="btn btn-p">Save workspace</button></div>
      </form>

      {workspace && (
        <section className="card card-b col settings-form" aria-label="Plan and usage">
          <div className="row between">
            <h2 className="card-t">Plan and usage</h2>
            <span className="small muted">Resets {resetsOn}</span>
          </div>
          <span className="hbar" role="img" aria-label={`${Math.round(usedShare)}% of this month's live runs used`}><i style={{ width: `${usedShare}%` }} /></span>
          <p className="small muted">{formatNumber(workspace.used)} of {formatNumber(workspace.monthlyRunLimit)} live runs used. Live runs and their retries count. Test runs are free.</p>
        </section>
      )}
    </div>
  );
}
