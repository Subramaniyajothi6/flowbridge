import { Clock, Copy, RefreshCw, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../api.ts";
import { formatDate } from "../format.ts";
import type { Connection, PollConfig, ScheduleConfig, Trigger, Workflow } from "../types.ts";

const schedulePresets = [
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every day at 9:00", cron: "0 9 * * *" },
  { label: "Mondays at 9:00", cron: "0 9 * * 1" },
];

// Ready-made addresses for services that are commonly checked for new items.
const pollPresets: Record<string, { url: string; itemsPath: string }> = {
  gmail: { url: "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread", itemsPath: "messages" },
  stripe: { url: "https://api.stripe.com/v1/events?limit=20", itemsPath: "data" },
};

type Props = {
  workflow: Workflow;
  triggers: Trigger[];
  connections: Connection[];
  testData: string;
  onTestDataChange: (value: string) => void;
  onChanged: () => Promise<void>;
};

export function TriggerPanel({ workflow, triggers, connections, testData, onTestDataChange, onChanged }: Props) {
  const webhookUrl = `${window.location.origin}/hooks/${workflow.webhookToken}`;
  const [copied, setCopied] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  async function copy() {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function createSecret() {
    const result = await api.createWebhookSecret(workflow.id);
    setSecret(result.webhookSecret);
    await onChanged();
  }

  return (
    <div className="cfg">
      <div className="cfg-h"><h2 className="card-t">Trigger</h2><p className="hint">Choose what starts this workflow.</p></div>
      <div className="cfg-b">
        <div className="field">
          <label className="label" htmlFor="test-data">Test data for the Run button</label>
          <textarea id="test-data" className="area mono" value={testData} onChange={(event) => onTestDataChange(event.target.value)} />
          <span className="hint">Use it in steps as <code className="var">{"{{trigger.name}}"}</code></span>
        </div>

        <div className="field">
          <span className="label">Webhook address</span>
          <div className="row">
            <input className="input mono" readOnly aria-label="Webhook address" value={webhookUrl} />
            <button className="btn btn-ic" aria-label="Copy webhook address" onClick={copy}><Copy size={14} aria-hidden="true" /></button>
          </div>
          <span className="hint" role="status">{copied ? "Copied" : "Send a POST here to start a run."}</span>
          {secret ? (
            <div className="notice warn col" style={{ alignItems: "stretch" }}>
              <strong>Copy this secret now. It will not be shown again.</strong>
              <code className="mono pre-wrap">{secret}</code>
            </div>
          ) : (
            <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={createSecret}>
              {workflow.requiresSignature ? "Replace signing secret" : "Require signed requests"}
            </button>
          )}
        </div>

        <div className="field">
          <span className="label">Schedules and checks</span>
          <div className="side-rows">
            {triggers.map((trigger) => <TriggerRow key={trigger.id} trigger={trigger} onChanged={onChanged} />)}
          </div>
        </div>

        <AddSchedule workflowId={workflow.id} onChanged={onChanged} />
        <AddPoll workflowId={workflow.id} connections={connections} onChanged={onChanged} />
      </div>
    </div>
  );
}

function describeTrigger(trigger: Trigger): string {
  if (trigger.type === "schedule") {
    const config = trigger.config as ScheduleConfig;
    return `${config.cron} (${config.timezone})`;
  }
  const config = trigger.config as PollConfig;
  return `${new URL(config.url).hostname}, every ${Math.round(config.intervalSeconds / 60)} min`;
}

function TriggerRow({ trigger, onChanged }: { trigger: Trigger; onChanged: () => Promise<void> }) {
  const Icon = trigger.type === "schedule" ? Clock : RefreshCw;

  async function toggle() {
    await api.setTriggerEnabled(trigger.id, !trigger.enabled);
    await onChanged();
  }

  async function remove() {
    await api.deleteTrigger(trigger.id);
    await onChanged();
  }

  return (
    <div className="side-row">
      <div className="row">
        <Icon size={14} aria-hidden="true" />
        <span className="grow mono trunc" title={describeTrigger(trigger)}>{describeTrigger(trigger)}</span>
        <button className={`toggle ${trigger.enabled ? "is-on" : ""}`} role="switch" aria-checked={trigger.enabled} aria-label="Turn on or off" onClick={toggle} />
        <button className="btn btn-g btn-ic btn-sm" aria-label="Delete trigger" onClick={remove}><Trash2 size={13} aria-hidden="true" /></button>
      </div>
      {trigger.enabled && <span className="hint">Next: {formatDate(trigger.nextFireAt)}</span>}
      {trigger.lastError && <span className="err-msg">{trigger.lastError}</span>}
    </div>
  );
}

function AddSchedule({ workflowId, onChanged }: { workflowId: string; onChanged: () => Promise<void> }) {
  const [cron, setCron] = useState("");
  const [error, setError] = useState<string | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api.createTrigger(workflowId, { type: "schedule", config: { cron, timezone } });
      setCron("");
      setError(null);
      await onChanged();
    } catch (problem) {
      setError((problem as Error).message);
    }
  }

  return (
    <form className="rule" onSubmit={submit}>
      <label className="label" htmlFor="cron">Add a schedule</label>
      <div className="row wrap">
        {schedulePresets.map((preset) => (
          <button type="button" className="chip" key={preset.cron} onClick={() => setCron(preset.cron)}>{preset.label}</button>
        ))}
      </div>
      <input id="cron" className="input mono" placeholder="0 9 * * 1" value={cron} onChange={(event) => setCron(event.target.value)} required />
      <span className="hint">Uses your timezone: {timezone}</span>
      {error && <span className="err-msg">{error}</span>}
      <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} disabled={!cron}>Add schedule</button>
    </form>
  );
}

function AddPoll({ workflowId, connections, onChanged }: { workflowId: string; connections: Connection[]; onChanged: () => Promise<void> }) {
  const [connectionId, setConnectionId] = useState("");
  const [url, setUrl] = useState("");
  const [itemsPath, setItemsPath] = useState("");
  const [itemIdField, setItemIdField] = useState("id");
  const [minutes, setMinutes] = useState(5);
  const [error, setError] = useState<string | null>(null);

  function chooseConnection(id: string) {
    setConnectionId(id);
    const preset = pollPresets[connections.find((item) => item.id === id)?.connector ?? ""];
    if (preset) {
      setUrl(preset.url);
      setItemsPath(preset.itemsPath);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api.createTrigger(workflowId, {
        type: "poll",
        config: { url, itemsPath, itemIdField, intervalSeconds: minutes * 60, ...(connectionId ? { connectionId } : {}) },
      });
      setUrl("");
      setConnectionId("");
      setItemsPath("");
      setError(null);
      await onChanged();
    } catch (problem) {
      setError((problem as Error).message);
    }
  }

  return (
    <form className="rule" onSubmit={submit}>
      <span className="label">Check a service for new items</span>
      <select className="select" aria-label="Connection" value={connectionId} onChange={(event) => chooseConnection(event.target.value)}>
        <option value="">No sign-in needed</option>
        {connections.map((item) => <option key={item.id} value={item.id}>{item.name}{item.account ? `: ${item.account}` : ""}</option>)}
      </select>
      <input className="input" aria-label="Address to check" placeholder="https://api.example.com/orders" type="url" value={url} onChange={(event) => setUrl(event.target.value)} required />
      <div className="kv" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
        <input className="input" aria-label="Where the list is" placeholder="List path, such as data" value={itemsPath} onChange={(event) => setItemsPath(event.target.value)} />
        <input className="input" aria-label="Item ID field" placeholder="ID field" value={itemIdField} onChange={(event) => setItemIdField(event.target.value)} required />
      </div>
      <label className="row small">
        Every
        <input className="input" style={{ width: 70 }} type="number" min={1} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
        minutes
      </label>
      {error && <span className="err-msg">{error}</span>}
      <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} disabled={!url}>Add check</button>
    </form>
  );
}
