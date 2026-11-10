import { Plus, Puzzle, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api.ts";
import { LogoPicker } from "../components/LogoPicker.tsx";
import type { CustomAppDraft, HttpMethod } from "../types.ts";
import { LOGO_HINT, readLogoFile } from "./logo-file.ts";

const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

// What the person types for one action. The two field lists are comma-separated.
type ActionForm = { name: string; method: HttpMethod; path: string; requiredFields: string; optionalFields: string; bodyTemplate: string };

const emptyAction: ActionForm = { name: "", method: "POST", path: "/", requiredFields: "", optionalFields: "", bodyTemplate: "" };

function splitNames(text: string): string[] {
  return text.split(",").map((name) => name.trim()).filter(Boolean);
}

function toDraftAction(form: ActionForm): CustomAppDraft["actions"][number] {
  return {
    name: form.name,
    method: form.method,
    path: form.path,
    fields: [
      ...splitNames(form.requiredFields).map((name) => ({ name, required: true })),
      ...splitNames(form.optionalFields).map((name) => ({ name, required: false })),
    ],
    bodyTemplate: form.bodyTemplate.trim() || undefined,
  };
}

export function AddAppDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authType, setAuthType] = useState<CustomAppDraft["authType"]>("bearer");
  const [headerName, setHeaderName] = useState("");
  const [testPath, setTestPath] = useState("/");
  const [actions, setActions] = useState<ActionForm[]>([emptyAction]);
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function chooseLogo(file: File | undefined) {
    setProblem(null);
    if (!file) return setLogo(undefined);
    try {
      setLogo(await readLogoFile(file));
    } catch (error) {
      setLogo(undefined);
      setProblem((error as Error).message);
    }
  }

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function updateAction(index: number, changes: Partial<ActionForm>) {
    setActions(actions.map((action, at) => (at === index ? { ...action, ...changes } : action)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setProblem(null);
    try {
      await api.addCustomApp({ name, baseUrl, authType, headerName: authType === "header" ? headerName : undefined, testPath, actions: actions.map(toDraftAction), logo });
      await onAdded(name);
    } catch (error) {
      setProblem((error as Error).message);
      setIsSaving(false);
    }
  }

  return (
    <div className="scrim">
      <form className="modal add-app" role="dialog" aria-modal="true" aria-labelledby="add-app-title" onSubmit={submit}>
        <div>
          <h2 id="add-app-title">Add app</h2>
          <p className="small muted">Describe the app's web API. You will find these details in the app's API documentation.</p>
        </div>

        <div className="field">
          <label className="label" htmlFor="app-name">App name <span className="req">*</span></label>
          <input id="app-name" className="input" required maxLength={60} autoFocus placeholder="Jira" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="app-url">Address <span className="req">*</span></label>
          <input id="app-url" className="input" required placeholder="https://yourcompany.atlassian.net" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
        </div>
        <div className="field">
          <span className="label">Logo (optional)</span>
          <LogoPicker
            preview={logo ? <img className="logo-preview" src={logo} alt="Chosen logo" /> : <span className="step-icon lg logo-empty"><Puzzle size={18} aria-hidden="true" /></span>}
            buttonLabel={logo ? "Choose another" : "Upload logo"}
            hint={logo ? LOGO_HINT : `Without one, the app's own icon is fetched from its website. ${LOGO_HINT}`}
            onFile={chooseLogo}
            extra={logo && <button type="button" className="btn btn-g btn-sm" onClick={() => setLogo(undefined)}>Remove</button>}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="app-auth">How it signs in</label>
          <select id="app-auth" className="select" value={authType} onChange={(event) => setAuthType(event.target.value as CustomAppDraft["authType"])}>
            <option value="bearer">Bearer token</option>
            <option value="header">API key in a header</option>
            <option value="basic">Email and API token</option>
          </select>
        </div>
        {authType === "header" && (
          <div className="field">
            <label className="label" htmlFor="app-header">Header name <span className="req">*</span></label>
            <input id="app-header" className="input" required placeholder="X-Api-Key" value={headerName} onChange={(event) => setHeaderName(event.target.value)} />
          </div>
        )}
        <div className="field">
          <label className="label" htmlFor="app-test">Path used by the Test button <span className="req">*</span></label>
          <input id="app-test" className="input" required placeholder="/rest/api/2/myself" value={testPath} onChange={(event) => setTestPath(event.target.value)} />
          <span className="hint">A harmless address that only works when signed in.</span>
        </div>

        <div className="row between">
          <span className="strong">Actions</span>
          <button type="button" className="btn btn-sm" onClick={() => setActions([...actions, emptyAction])}><Plus size={13} aria-hidden="true" /> Add action</button>
        </div>

        {actions.map((action, index) => (
          <fieldset className="add-app-action" key={index}>
            <legend className="sr-only">Action {index + 1}</legend>
            <div className="row">
              <input className="input grow" required maxLength={60} aria-label="Action name" placeholder="Create issue" value={action.name} onChange={(event) => updateAction(index, { name: event.target.value })} />
              {actions.length > 1 && (
                <button type="button" className="btn btn-g btn-ic btn-sm" aria-label={`Remove action ${index + 1}`} onClick={() => setActions(actions.filter((_action, at) => at !== index))}>
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="add-app-request">
              <select className="select" aria-label="Method" value={action.method} onChange={(event) => updateAction(index, { method: event.target.value as HttpMethod })}>
                {methods.map((method) => <option key={method}>{method}</option>)}
              </select>
              <input className="input" required aria-label="Path" placeholder="/rest/api/2/issue" value={action.path} onChange={(event) => updateAction(index, { path: event.target.value })} />
            </div>
            <input className="input" aria-label="Required fields" placeholder="Required fields, separated by commas: project, summary" value={action.requiredFields} onChange={(event) => updateAction(index, { requiredFields: event.target.value })} />
            <input className="input" aria-label="Optional fields" placeholder="Optional fields, separated by commas: description" value={action.optionalFields} onChange={(event) => updateAction(index, { optionalFields: event.target.value })} />
            {action.method !== "GET" && action.method !== "DELETE" && (
              <textarea className="input area mono" rows={3} aria-label="Body template" placeholder={'Optional JSON body: { "fields": { "summary": "{{summary}}" } }'} value={action.bodyTemplate} onChange={(event) => updateAction(index, { bodyTemplate: event.target.value })} />
            )}
          </fieldset>
        ))}
        <p className="hint">Use {"{{field}}"} in a path or body to place a field's value. Without a body, the fields are sent as JSON.</p>

        {problem && <div className="notice err pre-wrap" role="alert">{problem}</div>}

        <div className="modal-a">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-p" disabled={isSaving}>{isSaving ? "Adding..." : "Add app"}</button>
        </div>
      </form>
    </div>
  );
}
