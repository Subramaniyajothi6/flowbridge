import { Plus, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.ts";
import { PageHead, Shell } from "../components/Shell.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { formatDate } from "../format.ts";
import type { WorkflowSummary } from "../types.ts";
import { useLoad } from "../useLoad.ts";

export function WorkflowsPage() {
  const { data: workflows, error, loading, reload } = useLoad(api.listWorkflows);
  const [isCreating, setIsCreating] = useState(false);
  const [toDelete, setToDelete] = useState<WorkflowSummary | null>(null);

  async function confirmDelete() {
    if (!toDelete) return;
    await api.deleteWorkflow(toDelete.id);
    setToDelete(null);
    await reload();
  }

  return (
    <Shell>
      <div className="page">
        <PageHead title="Workflows" subtitle="Connect your services and run processes automatically.">
          <button className="btn btn-p" onClick={() => setIsCreating(true)}>
            <Plus size={15} aria-hidden="true" /> New workflow
          </button>
        </PageHead>

        {error && <div className="notice err">{error}</div>}

        <div className="card">
          {loading ? (
            <div className="card-b"><span className="skel" /></div>
          ) : workflows && workflows.length > 0 ? (
            <div className="tbl-wrap tbl-round">
              <table className="tbl">
                <thead>
                  <tr><th>Name</th><th>Steps</th><th>Version</th><th>Last run</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {workflows.map((workflow) => (
                    <tr key={workflow.id}>
                      <td><Link className="link-row" to={`/workflows/${workflow.id}`}>{workflow.name}</Link></td>
                      <td className="num">{workflow.stepCount}</td>
                      <td className="num">{workflow.versionNumber}</td>
                      <td>{workflow.lastRun ? <StatusBadge status={workflow.lastRun.status} /> : <span className="dim">Not run yet</span>}</td>
                      <td className="muted">{formatDate(workflow.createdAt)}</td>
                      <td className="r">
                        <button className="btn btn-g btn-ic btn-sm" aria-label={`Delete ${workflow.name}`} onClick={() => setToDelete(workflow)}>
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              <span className="empty-ic"><WorkflowIcon size={20} aria-hidden="true" /></span>
              <strong>No workflows yet</strong>
              <p className="muted">Create your first workflow to start automating.</p>
              <button className="btn btn-p" onClick={() => setIsCreating(true)}>New workflow</button>
            </div>
          )}
        </div>
      </div>

      {isCreating && <CreateWorkflowDialog onClose={() => setIsCreating(false)} />}

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
