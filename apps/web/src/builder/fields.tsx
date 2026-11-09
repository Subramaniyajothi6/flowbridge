import { Braces } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { PickerItem } from "./flow.ts";

export type DataGroup = { title: string; items: PickerItem[] };

type TextProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  groups: DataGroup[];
  multiline?: boolean;
  required?: boolean;
  placeholder?: string;
  hint?: string;
};

// A text box with a button that inserts a value from an earlier step.
export function DataField({ label, value, onChange, groups, multiline, required, placeholder, hint }: TextProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  function insert(path: string) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}{{${path}}}${value.slice(end)}`);
    setIsPickerOpen(false);
  }

  const shared = { id, ref: inputRef, value, placeholder, onChange: (event: { target: { value: string } }) => onChange(event.target.value) };

  return (
    <div className="field">
      <div className="row">
        <label className="label" htmlFor={id}>
          {label} {required && <span className="req">*</span>}
        </label>
        <button type="button" className="data-btn" onClick={() => setIsPickerOpen((open) => !open)} aria-expanded={isPickerOpen}>
          <Braces size={13} aria-hidden="true" /> Insert data
        </button>
      </div>
      {multiline ? <textarea className="area" {...shared} /> : <input className="input" {...shared} />}
      {hint && <span className="hint">{hint}</span>}
      {isPickerOpen && <DataPicker groups={groups} onPick={insert} />}
    </div>
  );
}

function DataPicker({ groups, onPick }: { groups: DataGroup[]; onPick: (path: string) => void }) {
  const withValues = groups.filter((group) => group.items.length > 0);
  if (withValues.length === 0) {
    return <div className="preview">No data yet. Run the workflow, or test an earlier step, to see values here.</div>;
  }

  return (
    <div className="picker">
      {withValues.map((group) => (
        <div key={group.title}>
          <div className="picker-h">{group.title}</div>
          {group.items.map((item) => (
            <button type="button" className="picker-i" key={item.path} onClick={() => onPick(item.path)}>
              <span className="mono trunc">{item.path.split(".").slice(-2).join(".")}</span>
              <span className="dim trunc">{item.preview}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
