import { ArrowDown, ArrowUp } from "lucide-react";
import type { RunFormField, RunFormKind } from "../types.ts";

const KINDS: { value: RunFormKind; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "choice", label: "Choose from a list" },
];

// "low, normal, urgent" becomes ["low", "normal", "urgent"].
function optionsFromText(text: string): string[] {
  return text.split(",").map((option) => option.trim()).filter(Boolean);
}

// Sets up the form people fill in when they press Run now, for example a Business User.
// Each detail the steps use is one question. The builder chooses its label, its kind and its order.
export function RunFormEditor({ fields, onChange }: { fields: RunFormField[]; onChange: (fields: RunFormField[]) => void }) {
  if (fields.length === 0) {
    return (
      <div className="field">
        <span className="label">Run now form</span>
        <span className="hint">This workflow does not use any details from the person who starts it, so the form will have no questions.</span>
      </div>
    );
  }

  function update(index: number, change: Partial<RunFormField>) {
    onChange(fields.map((field, position) => (position === index ? { ...field, ...change } : field)));
  }

  function move(index: number, by: -1 | 1) {
    const next = [...fields];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  }

  return (
    <div className="field">
      <span className="label">Run now form</span>
      <span className="hint">What people are asked when they start this workflow with Run now, such as a Business User. One question for each detail the steps use.</span>
      <div className="run-form-list">
        {fields.map((field, index) => (
          <div className="run-form-row" key={field.path}>
            <div className="row">
              <input className="input grow" aria-label={`Question for ${field.path}`} value={field.label} maxLength={60} onChange={(event) => update(index, { label: event.target.value })} />
              <button type="button" className="btn btn-g btn-ic btn-sm" aria-label={`Move ${field.label} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={13} aria-hidden="true" /></button>
              <button type="button" className="btn btn-g btn-ic btn-sm" aria-label={`Move ${field.label} down`} disabled={index === fields.length - 1} onClick={() => move(index, 1)}><ArrowDown size={13} aria-hidden="true" /></button>
            </div>
            <div className="row wrap">
              <select className="select run-form-kind" aria-label={`Kind of answer for ${field.label}`} value={field.kind} onChange={(event) => update(index, { kind: event.target.value as RunFormKind })}>
                {KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
              </select>
              <label className="row small">
                <input type="checkbox" checked={field.required} onChange={(event) => update(index, { required: event.target.checked })} /> Required
              </label>
              <code className="var small">{`{{trigger.${field.path}}}`}</code>
            </div>
            {field.kind === "choice" && (
              <input
                className="input"
                aria-label={`Choices for ${field.label}`}
                placeholder="Choices, separated by commas: low, normal, urgent"
                defaultValue={(field.options ?? []).join(", ")}
                onBlur={(event) => update(index, { options: optionsFromText(event.target.value) })}
              />
            )}
            <input className="input" aria-label={`Help text for ${field.label}`} placeholder="Help text under the question (optional)" value={field.hint ?? ""} maxLength={160} onChange={(event) => update(index, { hint: event.target.value || undefined })} />
          </div>
        ))}
      </div>
    </div>
  );
}
