import { Play } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { humanize } from "../format.ts";
import type { InputField, WorkflowSummary } from "../types.ts";

// Puts each answer where the workflow reads it: "body.email" becomes { body: { email: ... } }.
function buildData(values: Record<string, string>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(values)) {
    const parts = path.split(".");
    let target = data;
    for (const part of parts.slice(0, -1)) {
      target[part] = (target[part] as Record<string, unknown>) ?? {};
      target = target[part] as Record<string, unknown>;
    }
    target[parts[parts.length - 1]] = value.trim();
  }
  return data;
}

function inputType(field: InputField): string {
  const lower = field.name.toLowerCase();
  if (field.kind === "email" || lower.includes("email")) return "email";
  if (lower.includes("phone")) return "tel";
  if (lower.includes("url") || lower.includes("website")) return "url";
  return "text";
}

// One question, drawn the way the workflow's builder chose: a box, a large box or a list to pick from.
function FormField({ field, value, autoFocus, onChange }: { field: InputField; value: string; autoFocus: boolean; onChange: (value: string) => void }) {
  const id = `run-${field.path}`;
  const common = { id, required: field.required, autoFocus, value, "aria-describedby": field.hint ? `${id}-hint` : undefined };

  let control;
  if (field.kind === "long_text") {
    control = <textarea {...common} className="input area" rows={4} onChange={(event) => onChange(event.target.value)} />;
  } else if (field.kind === "choice" && field.options?.length) {
    control = (
      <select {...common} className="select" onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose one</option>
        {field.options.map((option) => <option key={option} value={option}>{humanize(option)}</option>)}
      </select>
    );
  } else {
    control = <input {...common} className="input" type={inputType(field)} onChange={(event) => onChange(event.target.value)} />;
  }

  return (
    <div className="field">
      <label className="label" htmlFor={id}>{field.label}{!field.required && <span className="dim"> (optional)</span>}</label>
      {control}
      {field.hint && <span className="hint" id={`${id}-hint`}>{field.hint}</span>}
    </div>
  );
}

// Starts a published workflow. It asks for the details the workflow uses, in plain fields,
// so nobody has to write JSON. People who build workflows can still enter JSON.
export function RunWorkflowDialog({ workflow, onClose }: { workflow: WorkflowSummary; onClose: () => void }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const fields = workflow.inputFields ?? [];
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(fields.map((field) => [field.path, ""])));
  const [useJson, setUseJson] = useState(false);
  const [json, setJson] = useState(JSON.stringify(buildData(Object.fromEntries(fields.map((field) => [field.path, ""]))), null, 2));
  const [problem, setProblem] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    let data: unknown = buildData(values);
    if (useJson) {
      try {
        data = json.trim() ? JSON.parse(json) : {};
      } catch {
        setProblem("That is not valid JSON.");
        return;
      }
    }

    setIsSending(true);
    try {
      const run = await api.startRun(workflow.id, data);
      navigate(`/executions/${run.id}`);
    } catch (failure) {
      setProblem((failure as Error).message);
      setIsSending(false);
    }
  }

  return (
    <div className="scrim">
      <form className="modal run-dialog" role="dialog" aria-modal="true" aria-labelledby="run-title" onSubmit={submit}>
        <h2 id="run-title">Run {workflow.name}</h2>
        {workflow.description && <p className="muted">{workflow.description}</p>}

        {useJson ? (
          <div className="field">
            <label className="label" htmlFor="run-json">Data to start with (JSON)</label>
            <textarea id="run-json" className="input area mono" rows={7} value={json} onChange={(event) => setJson(event.target.value)} />
          </div>
        ) : fields.length === 0 ? (
          <p className="run-none">This workflow does not need any details to start.</p>
        ) : (
          <div className="col run-fields">
            <p className="small muted">Fill in the details this workflow uses.</p>
            {fields.map((field, index) => (
              <FormField key={field.path} field={field} value={values[field.path] ?? ""} autoFocus={index === 0} onChange={(value) => setValues({ ...values, [field.path]: value })} />
            ))}
          </div>
        )}

        <p className="notice warn run-warning">This runs for real. Messages are sent and records are changed.</p>
        {problem && <p className="err-msg" role="alert">{problem}</p>}

        <div className="modal-a">
          {can("workflows.edit") && (
            <button type="button" className="btn btn-g run-json-toggle" onClick={() => setUseJson(!useJson)}>{useJson ? "Use the form" : "Enter JSON instead"}</button>
          )}
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-p" disabled={isSending}><Play size={14} aria-hidden="true" /> {isSending ? "Starting..." : "Run now"}</button>
        </div>
      </form>
    </div>
  );
}
