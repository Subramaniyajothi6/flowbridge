import { History } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.ts";
import { PageHead, Shell } from "../components/Shell.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { formatDate, formatDuration, humanize } from "../format.ts";
import { useLoad } from "../useLoad.ts";

const filters = [
  { value: "", label: "All" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "running", label: "Running" },
];

export function ExecutionsPage() {
  const [status, setStatus] = useState("");
  const { data: runs, error, loading, reload } = useLoad(() => api.listRuns(status), [status]);

  const hasActiveRun = runs?.some((run) => run.status === "queued" || run.status === "running");

  useEffect(() => {
    if (!hasActiveRun) return;
    const timer = setInterval(reload, 3000);
    return () => clearInterval(timer);
  }, [hasActiveRun, reload]);

  return (
    <Shell>
      <div className="page">
        <PageHead title="Executions" subtitle="Every workflow run, and what happened at each step." />

        <div className="row wrap" role="group" aria-label="Filter by status">
          {filters.map((filter) => (
            <button key={filter.value} className={`chip ${status === filter.value ? "is-on" : ""}`} onClick={() => setStatus(filter.value)} aria-pressed={status === filter.value}>
              {filter.label}
            </button>
          ))}
        </div>

        {error && <div className="notice err">{error}</div>}

        <div className="card">
          {loading ? (
            <div className="card-b"><span className="skel" /></div>
          ) : runs && runs.length > 0 ? (
            <div className="tbl-wrap tbl-round">
              <table className="tbl">
                <thead><tr><th>Workflow</th><th>Status</th><th>Started by</th><th>Started</th><th>Duration</th></tr></thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className={run.status === "failed" ? "is-fail" : ""}>
                      <td><Link className="link-row" to={`/executions/${run.id}`}>{run.workflowName}</Link></td>
                      <td><StatusBadge status={run.status} /></td>
                      <td className="muted">{humanize(run.triggerType)}</td>
                      <td className="muted">{formatDate(run.createdAt)}</td>
                      <td className="num">{formatDuration(run.startedAt, run.finishedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              <span className="empty-ic"><History size={20} aria-hidden="true" /></span>
              <strong>No executions found</strong>
              <p className="muted">Runs appear here as soon as a workflow starts.</p>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
