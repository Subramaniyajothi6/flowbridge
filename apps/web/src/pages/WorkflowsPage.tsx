import { Play, Plus, Search, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { PageHead, Shell } from "../components/Shell.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { formatDate, formatNumber, formatPercent } from "../format.ts";
import type { PublicationStatus, WorkflowSummary } from "../types.ts";
import { useLoad } from "../useLoad.ts";

const statusFilters = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

function PublicationBadge({ workflow }: { workflow: WorkflowSummary }) {
  const labels: Record<PublicationStatus, { className: string; text: string }> = {
    draft: { className: "b-off", text: "Draft" },
    published: { className: "b-ok", text: `Published, Version ${workflow.versionNumber}` },
    published_with_edits: { className: "b-warn", text: `Version ${workflow.versionNumber}, draft edited` },
  };
  const { className, text } = labels[workflow.status];
  return <span className={`badge ${className}`}>{text}</span>;
}

export function WorkflowsPage() {
  const { can } = useAuth();
  const { data: workflows, error, loading, reload } = useLoad(api.listWorkflows);
  const [isCreating, setIsCreating] = useState(false);
  const [toDelete, setToDelete] = useState<WorkflowSummary | null>(null);
  const [toRun, setToRun] = useState<WorkflowSummary | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const canEdit = can("workflows.edit");
  const canOpenBuilder = can("builder.view");

  const visible = workflows?.filter((workflow) => {
    const matchesSearch = workflow.name.toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus = status === "all" || (status === "draft" ? workflow.status === "draft" : workflow.status !== "draft");
    return matchesSearch && matchesStatus;
  });

  async function confirmDelete() {
    if (!toDelete) return;
    await api.deleteWorkflow(toDelete.id);
    setToDelete(null);
    await reload();
  }

  return (
    <Shell>
      <div className="page">
        <PageHead title="Workflows" subtitle="Every automation in your workspace, with how each one is performing.">
          {canEdit && (
            <button className="btn btn-p" onClick={() => setIsCreating(true)}>
              <Plus size={15} aria-hidden="true" /> Create workflow
            </button>
          )}
        </PageHead>

        {error && <div className="notice err">{error}</div>}

        <div className="row wrap">
          <div className="list-search">
            <span className="search-ic"><Search size={14} aria-hidden="true" /></span>
            <input className="input" type="search" aria-label="Search workflows" placeholder="Search workflows" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="row wrap" role="group" aria-label="Filter by status">
            {statusFilters.map((filter) => (
              <button key={filter.value} className={`chip ${status === filter.value ? "is-on" : ""}`} aria-pressed={status === filter.value} onClick={() => setStatus(filter.value)}>{filter.label}</button>
            ))}
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div className="card-b"><span className="skel" /></div>
          ) : visible && visible.length > 0 ? (
            <div className="tbl-wrap tbl-round">
              <table className="tbl">
                <thead>
                  <tr><th>Workflow</th><th>Status</th><th>Last run</th><th className="r hide-m">Success rate</th><th className="r hide-m">Runs, 30 days</th><th className="hide-m">Last updated</th><th><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {visible.map((workflow) => (
                    <tr key={workflow.id}>
                      <td>
                        {canOpenBuilder ? <Link className="link-row" to={`/workflows/${workflow.id}`}>{workflow.name}</Link> : <span className="strong">{workflow.name}</span>}
                        <div className="small muted">{workflow.stepCount} {workflow.stepCount === 1 ? "step" : "steps"}</div>
                      </td>
                      <td><PublicationBadge workflow={workflow} /></td>
                      <td>{workflow.lastRun ? <StatusBadge status={workflow.lastRun.status} /> : <span className="dim">Never run</span>}</td>
                      <td className="r num hide-m">{formatPercent(workflow.last30Days.succeeded, workflow.last30Days.succeeded + workflow.last30Days.failed)}</td>
                      <td className="r num hide-m">{formatNumber(workflow.last30Days.total)}</td>
                      <td className="muted hide-m">
                        {formatDate(workflow.updatedAt)}
                        {workflow.updatedBy && <div className="small dim">{workflow.updatedBy}</div>}
                      </td>
                      <td className="r">
                        <div className="row team-actions">
                          {can("workflows.run") && workflow.status !== "draft" && (
                            <button className="btn btn-sm" onClick={() => setToRun(workflow)}><Play size={13} aria-hidden="true" /> Run</button>
                          )}
                          {canEdit && (
                            <button className="btn btn-g btn-ic btn-sm" aria-label={`Delete ${workflow.name}`} onClick={() => setToDelete(workflow)}>
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              <span className="empty-ic"><WorkflowIcon size={20} aria-hidden="true" /></span>
              <strong>{workflows?.length ? "No workflows match" : "No workflows yet"}</strong>
              <p className="muted">{workflows?.length ? "Try a different search or filter." : canEdit ? "Create your first workflow to start automating." : "Workflows will appear here once they are created."}</p>
              {canEdit && !workflows?.length && <button className="btn btn-p" onClick={() => setIsCreating(true)}>Create workflow</button>}
            </div>
          )}
        </div>
      </div>

      {isCreating && <CreateWorkflowDialog onClose={() => setIsCreating(false)} />}
      {toRun && <RunWorkflowDialog workflow={toRun} onClose={() => setToRun(null)} />}

      {toDelete && (
        <div className="scrim">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Delete workflow">
            <h2>Delete "{toDelete.name}"?</h2>
            <p className="muted">This also deletes its run history and triggers. It cannot be undone.</p>
            <div className="modal-a">
              <button className="btn" onClick={() => setToDelete(null)}>Cancel</button>
              <button className="btn btn-d" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function RunWorkflowDialog({ workflow, onClose }: { workflow: WorkflowSummary; onClose: () => void }) {
  const navigate = useNavigate();
  const [text, setText] = useState("{\n  \n}");
  const [problem, setProblem] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    let data: unknown = {};
    try {
      if (text.trim()) data = JSON.parse(text);
    } catch {
      setProblem("That is not valid JSON.");
      return;
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
      <form className="modal" role="dialog" aria-modal="true" aria-label={`Run ${workflow.name}`} onSubmit={submit}>
        <h2>Run "{workflow.name}"</h2>
        <p className="muted">This is a real run. It really sends messages and changes data.</p>
        <div className="field">
          <label className="label" htmlFor="run-data">Data to start with (JSON, optional)</label>
          <textarea id="run-data" className="input area mono" rows={6} value={text} onChange={(event) => setText(event.target.value)} />
        </div>
        {problem && <p className="err-msg">{problem}</p>}
        <div className="modal-a">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-p" disabled={isSending}>Run workflow</button>
        </div>
      </form>
    </div>
  );
}

function CreateWorkflowDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const workflow = await api.createWorkflow(name.trim());
      navigate(`/workflows/${workflow.id}`);
    } catch (problem) {
      setError((problem as Error).message);
    }
  }

  return (
    <div className="scrim">
      <form className="modal" role="dialog" aria-modal="true" aria-label="New workflow" onSubmit={submit}>
        <h2>New workflow</h2>
        <div className="field">
          <label className="label" htmlFor="workflow-name">Name</label>
          <input id="workflow-name" className="input" value={name} onChange={(event) => setName(event.target.value)} autoFocus required maxLength={120} />
        </div>
        {error && <p className="err-msg">{error}</p>}
        <div className="modal-a">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-p" disabled={!name.trim()}>Create</button>
        </div>
      </form>
    </div>
  );
}
