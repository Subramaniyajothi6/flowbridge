import { FlaskConical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { StepIcon } from "../components/StepIcon.tsx";
import { formatJson, humanize } from "../format.ts";
import type { ApprovalConfig, Connection, ConnectorConfig, ConnectorInfo, DelayConfig, DelayUnit, HttpConfig, HttpMethod, IfConfig, IfOperator, LoopAction, LoopConfig, RetryPolicy, WorkflowStep } from "../types.ts";
import { DataField, type DataGroup } from "./fields.tsx";

const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const operators: { value: IfOperator; label: string }[] = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
  { value: "contains", label: "Contains" },
  { value: "exists", label: "Has a value" },
];

type TestResult = { ok: boolean; output?: unknown; error?: string };

type Props = {
  step: WorkflowStep;
  groups: DataGroup[];
  connectors: ConnectorInfo[];
  connections: Connection[];
  onChange: (step: WorkflowStep) => void;
  onDelete: () => void;
  onTest: () => Promise<TestResult>;
};

export function StepPanel({ step, groups, connectors, connections, onChange, onDelete, onTest }: Props) {
  const [result, setResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  async function test() {
    setIsTesting(true);
    setResult(await onTest());
    setIsTesting(false);
  }

  return (
    <div className="cfg">
      <div className="cfg-h row">
        <StepIcon step={step} />
        <input className="cfg-title" aria-label="Step name" value={step.name} onChange={(event) => onChange({ ...step, name: event.target.value })} />
      </div>

      <div className="cfg-b">
        {step.type === "http_request" && <HttpFields config={step.config} groups={groups} onChange={(config) => onChange({ ...step, config })} />}
        {step.type === "if" && <IfFields config={step.config} groups={groups} onChange={(config) => onChange({ ...step, config })} />}
        {step.type === "connector" && <ConnectorFields config={step.config} groups={groups} connectors={connectors} connections={connections} onChange={(config) => onChange({ ...step, config })} />}
        {step.type === "delay" && <DelayFields config={step.config} onChange={(config) => onChange({ ...step, config })} />}
        {step.type === "approval" && <ApprovalFields config={step.config} groups={groups} onChange={(config) => onChange({ ...step, config })} />}
        {step.type === "loop" && <LoopFields config={step.config} groups={groups} connectors={connectors} connections={connections} onChange={(config) => onChange({ ...step, config })} />}

        {(step.type === "http_request" || step.type === "connector" || step.type === "loop") && <RetryFields retry={step.retry} onChange={(retry) => onChange({ ...step, retry })} />}

        <p className="hint">To run other steps when this one fails, connect the red dot at the bottom of the step.</p>

        <div className="field">
          <span className="label">Reference for later steps</span>
          <code className="var">{`{{steps.${step.id}.output}}`}</code>
        </div>

        {result && (
          <div className="field" role="status">
            <span className="label">Test result</span>
            {result.ok ? <pre className="code">{formatJson(result.output)}</pre> : <div className="notice err pre-wrap">{result.error}</div>}
          </div>
        )}
      </div>

      <div className="cfg-f">
        <button className="btn grow" onClick={test} disabled={isTesting} title="Runs this one step for real, using the latest sample data">
          <FlaskConical size={14} aria-hidden="true" /> {isTesting ? "Testing..." : "Test step"}
        </button>
        <button className="btn btn-ic" aria-label="Delete step" onClick={onDelete}>
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function HttpFields({ config, groups, onChange }: { config: HttpConfig; groups: DataGroup[]; onChange: (config: HttpConfig) => void }) {
  const [rows, setRows] = useState(() => Object.entries(config.headers));
  const [bodyText, setBodyText] = useState(() => (typeof config.body === "string" ? config.body : config.body === undefined ? "" : formatJson(config.body)));

  function updateRows(next: [string, string][]) {
    setRows(next);
    onChange({ ...config, headers: Object.fromEntries(next.filter(([name]) => name.trim())) });
  }

  // Valid JSON is sent as JSON, and anything else as plain text.
  function updateBody(text: string) {
    setBodyText(text);
    let body: unknown = text === "" ? undefined : text;
    try {
      if (text) body = JSON.parse(text);
    } catch {
      // Not JSON, so it stays as text.
    }
    onChange({ ...config, body });
  }

  return (
    <>
      <div className="field">
        <label className="label" htmlFor="http-method">Method</label>
        <select id="http-method" className="select" value={config.method} onChange={(event) => onChange({ ...config, method: event.target.value as HttpMethod })}>
          {methods.map((method) => <option key={method}>{method}</option>)}
        </select>
      </div>
      <DataField label="URL" required value={config.url} groups={groups} placeholder="https://api.example.com/items" onChange={(url) => onChange({ ...config, url })} />
      <div className="field">
        <span className="label">Headers</span>
        {rows.map(([name, value], index) => (
          <div className="kv" key={index}>
            <input className="input" aria-label="Header name" placeholder="Name" value={name} onChange={(event) => updateRows(rows.map((row, at) => (at === index ? [event.target.value, row[1]] : row)))} />
            <input className="input" aria-label="Header value" placeholder="Value" value={value} onChange={(event) => updateRows(rows.map((row, at) => (at === index ? [row[0], event.target.value] : row)))} />
            <button type="button" className="btn btn-g btn-ic btn-sm" aria-label="Remove header" onClick={() => updateRows(rows.filter((_row, at) => at !== index))}>
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setRows([...rows, ["", ""]])}>
          <Plus size={13} aria-hidden="true" /> Add header
        </button>
      </div>
      {config.method !== "GET" && <DataField label="Body" multiline value={bodyText} groups={groups} placeholder='{ "name": "value" }' onChange={updateBody} />}
    </>
  );
}

function IfFields({ config, groups, onChange }: { config: IfConfig; groups: DataGroup[]; onChange: (config: IfConfig) => void }) {
  return (
    <div className="rule">
      <DataField label="Value" required value={String(config.left ?? "")} groups={groups} onChange={(left) => onChange({ ...config, left })} />
      <div className="field">
        <label className="label" htmlFor="if-operator">Condition</label>
        <select id="if-operator" className="select" value={config.operator} onChange={(event) => onChange({ ...config, operator: event.target.value as IfOperator })}>
          {operators.map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
        </select>
      </div>
      {config.operator !== "exists" && <DataField label="Compare with" required value={String(config.right ?? "")} groups={groups} onChange={(right) => onChange({ ...config, right })} />}
    </div>
  );
}

function ConnectorFields({ config, groups, connectors, connections, onChange }: { config: ConnectorConfig; groups: DataGroup[]; connectors: ConnectorInfo[]; connections: Connection[]; onChange: (config: ConnectorConfig) => void }) {
  const connector = connectors.find((item) => item.id === config.connector);
  const action = connector?.actions.find((item) => item.id === config.action);
  const available = connections.filter((item) => item.connector === config.connector);
  const fields = Object.entries(action?.inputSchema.properties ?? {});

  // An empty optional field is left out, rather than sent as blank text.
  function updateParam(name: string, value: unknown) {
    const params = { ...config.params };
    if (value === "" || (Array.isArray(value) && value.length === 0)) delete params[name];
    else params[name] = value;
    onChange({ ...config, params });
  }

  return (
    <>
      <p className="hint">{connector?.name}: {action?.description}</p>
      <div className="field">
        <label className="label" htmlFor="connection">Connection <span className="req">*</span></label>
        <select id="connection" className="select" value={config.connectionId} onChange={(event) => onChange({ ...config, connectionId: event.target.value })}>
          <option value="">Choose a connection</option>
          {available.map((item) => <option key={item.id} value={item.id}>{item.account ?? item.name}</option>)}
        </select>
        {available.length === 0 && <span className="hint">None yet. <Link to="/integrations">Connect {connector?.name}</Link></span>}
      </div>
      {fields.map(([name, schema]) => {
        const required = action?.inputSchema.required?.includes(name);
        if (schema.type === "array") {
          return <ListField key={name} label={humanize(name)} required={required} value={(config.params[name] as unknown[] | undefined) ?? []} groups={groups} onChange={(value) => updateParam(name, value)} />;
        }
        // A field with fixed choices, such as an email's Style, is a dropdown.
        if (schema.enum) {
          return (
            <div className="field" key={name}>
              <label className="label" htmlFor={`param-${name}`}>{humanize(name)}{required && <span className="req"> *</span>}</label>
              <select id={`param-${name}`} className="select" value={String(config.params[name] ?? "")} onChange={(event) => updateParam(name, event.target.value)}>
                {!required && <option value="">Default</option>}
                {schema.enum.map((choice) => <option key={String(choice)} value={String(choice)}>{humanize(String(choice))}</option>)}
              </select>
            </div>
          );
        }
        return <DataField key={name} label={humanize(name)} required={required} multiline={name === "body" || name === "text" || name === "facts"} value={String(config.params[name] ?? "")} groups={groups} placeholder={schema.default !== undefined ? String(schema.default) : undefined} onChange={(value) => updateParam(name, value)} />;
      })}
    </>
  );
}

function numberFrom(text: string): number {
  return Math.max(0, Math.floor(Number(text) || 0));
}

const delayUnits: DelayUnit[] = ["seconds", "minutes", "hours", "days"];

function DelayFields({ config, onChange }: { config: DelayConfig; onChange: (config: DelayConfig) => void }) {
  return (
    <div className="field">
      <span className="label">Wait for <span className="req">*</span></span>
      <div className="row">
        <input className="input" type="number" min={1} aria-label="Amount of time" value={config.amount} onChange={(event) => onChange({ ...config, amount: numberFrom(event.target.value) })} />
        <select className="select" aria-label="Unit of time" value={config.unit} onChange={(event) => onChange({ ...config, unit: event.target.value as DelayUnit })}>
          {delayUnits.map((unit) => <option key={unit} value={unit}>{humanize(unit)}</option>)}
        </select>
      </div>
      <span className="hint">The longest wait is 7 days. Waits are checked every 20 seconds.</span>
    </div>
  );
}

function ApprovalFields({ config, groups, onChange }: { config: ApprovalConfig; groups: DataGroup[]; onChange: (config: ApprovalConfig) => void }) {
  return (
    <>
      <DataField label="Message for the person deciding" required multiline value={config.message} groups={groups} onChange={(message) => onChange({ ...config, message })} />
      <div className="field">
        <label className="label" htmlFor="approval-timeout">Give up after (hours)</label>
        <input id="approval-timeout" className="input" type="number" min={1} max={168} value={config.timeoutHours} onChange={(event) => onChange({ ...config, timeoutHours: numberFrom(event.target.value) })} />
        <span className="hint">If nobody decides in time, the step fails. The decision is made on the run's page.</span>
      </div>
    </>
  );
}

function LoopFields({ config, groups, connectors, connections, onChange }: { config: LoopConfig; groups: DataGroup[]; connectors: ConnectorInfo[]; connections: Connection[]; onChange: (config: LoopConfig) => void }) {
  const action = config.action;
  const itemGroups: DataGroup[] = [{ title: "Current item", items: [{ path: "loop.item", preview: "The item itself" }, { path: "loop.index", preview: "Its position, from 0" }] }, ...groups];
  const chosen = action.type === "connector" ? `${action.config.connector}:${action.config.action}` : "http_request";

  function chooseAction(value: string) {
    if (value === "http_request") {
      onChange({ ...config, action: { type: "http_request", config: { method: "POST", url: "", headers: {} } } });
      return;
    }
    const [connector, actionId] = value.split(":");
    const connectionId = connections.find((item) => item.connector === connector)?.id ?? "";
    onChange({ ...config, action: { type: "connector", config: { connector, action: actionId, connectionId, params: {} } } });
  }

  const updateAction = (next: LoopAction) => onChange({ ...config, action: next });

  return (
    <>
      <DataField label="Items" required value={String(config.items ?? "")} groups={groups} placeholder="{{steps.get_orders.output.items}}" hint="A list from an earlier step. At most 100 items." onChange={(items) => onChange({ ...config, items })} />
      <div className="field">
        <label className="label" htmlFor="loop-action">Action for each item</label>
        <select id="loop-action" className="select" value={chosen} onChange={(event) => chooseAction(event.target.value)}>
          <option value="http_request">HTTP request</option>
          {connectors.flatMap((connector) => connector.actions.map((item) => (
            <option key={`${connector.id}:${item.id}`} value={`${connector.id}:${item.id}`}>{connector.name}: {humanize(item.id)}</option>
          )))}
        </select>
      </div>
      {action.type === "http_request" && <HttpFields key="http" config={action.config} groups={itemGroups} onChange={(next) => updateAction({ type: "http_request", config: next })} />}
      {action.type === "connector" && <ConnectorFields key={chosen} config={action.config} groups={itemGroups} connectors={connectors} connections={connections} onChange={(next) => updateAction({ type: "connector", config: next })} />}
    </>
  );
}

function RetryFields({ retry, onChange }: { retry?: RetryPolicy; onChange: (retry: RetryPolicy | undefined) => void }) {
  const maxAttempts = retry?.maxAttempts ?? 1;
  const delaySeconds = retry?.delaySeconds ?? 30;

  return (
    <div className="field">
      <label className="label" htmlFor="retry-attempts">If this step fails</label>
      <select id="retry-attempts" className="select" value={maxAttempts} onChange={(event) => {
        const attempts = Number(event.target.value);
        onChange(attempts === 1 ? undefined : { maxAttempts: attempts, delaySeconds });
      }}>
        <option value={1}>Do not retry</option>
        {[2, 3, 4, 5].map((attempts) => <option key={attempts} value={attempts}>Try up to {attempts} times</option>)}
      </select>
      {maxAttempts > 1 && (
        <>
          <label className="label" htmlFor="retry-delay">Seconds before the first retry</label>
          <input id="retry-delay" className="input" type="number" min={1} max={3600} value={delaySeconds} onChange={(event) => onChange({ maxAttempts, delaySeconds: Math.max(1, numberFrom(event.target.value)) })} />
          <span className="hint">The wait doubles after each retry.</span>
        </>
      )}
    </div>
  );
}

function ListField({ label, required, value, groups, onChange }: { label: string; required?: boolean; value: unknown[]; groups: DataGroup[]; onChange: (value: string[]) => void }) {
  const [text, setText] = useState(() => value.map(String).join("\n"));

  return (
    <DataField
      label={label}
      required={required}
      multiline
      value={text}
      groups={groups}
      hint="One value per line. Each line becomes a column."
      onChange={(next) => {
        setText(next);
        onChange(next.split("\n").map((line) => line.trim()).filter(Boolean));
      }}
    />
  );
}
