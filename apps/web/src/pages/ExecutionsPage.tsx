import { Download, History } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.ts";
import { PageHead, Shell } from "../components/Shell.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { formatDate, formatDuration, formatNumber, humanize } from "../format.ts";
import type { RunSummary } from "../types.ts";
import { useLoad } from "../useLoad.ts";

const statusFilters = [
  { value: "", label: "All" },
  { value: "failed", label: "Failed" },
  { value: "running", label: "Running" },
  { value: "waiting", label: "Waiting" },
  { value: "succeeded", label: "Successful" },
];

const modes = [
  { value: "live", label: "Live" },
  { value: "test", label: "Test" },
  { value: "", label: "All" },
];

// A leading = or + would make a spreadsheet treat the value as a formula.
function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

function downloadCsv(runs: RunSummary[]) {
  const header = ["Workflow", "Status", "Run type", "Trigger", "Started", "Duration", "Error"];
  const rows = runs.map((run) => [run.workflowName, run.status, run.mode, run.triggerType, run.createdAt, formatDuration(run.startedAt, run.finishedAt), run.error ?? ""]);
  const text = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  link.download = "flowbridge-executions.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

export function ExecutionsPage() {
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("live");
  const { data: runs, error, loading, reload } = useLoad(() => api.listRuns(status, mode), [status, mode]);
  const totals = useLoad(() => api.analytics(30));

  const hasActiveRun = runs?.some((run) => run.status === "queued" || run.status === "running");

  useEffect(() => {
    if (!hasActiveRun) return;
    const timer = setInterval(reload, 3000);
    return () => clearInterval(timer);
  }, [hasActiveRun, reload]);

  return (
    <Shell>
      <div className="page">
        <PageHead title="Executions" subtitle="Every workflow run, and which step it reached. Totals count live runs only, so testing never skews your numbers.">
          <button className="btn" disabled={!runs?.length} onClick={() => runs && downloadCsv(runs)}><Download size={14} aria-hidden="true" /> Export CSV</button>
        </PageHead>

        {totals.data && (
          <section className="card stats" aria-label="Last 30 days">
            <div className="stat"><span className="stat-l">Total live executions</span><span className="stat-v">{formatNumber(totals.data.totals.total)}</span></div>
            <div className="stat"><span className="stat-l">Successful</span><span className="stat-v">{formatNumber(totals.data.totals.succeeded)}</span></div>
            <div className="stat"><span className="stat-l">Failed</span><span className="stat-v">{formatNumber(totals.data.totals.failed)}</span></div>
            <div className="stat"><span className="stat-l">In progress</span><span className="stat-v">{formatNumber(totals.data.totals.active)}</span></div>
          </section>
        )}

        <div className="row wrap">
          <div className="seg-ctl" role="group" aria-label="Run type">
            {modes.map((item) => (
              <button key={item.value} className={mode === item.value ? "is-on" : ""} aria-pressed={mode === item.value} onClick={() => setMode(item.value)}>{item.label}</button>
            ))}
          </div>
          <div className="row wrap" role="group" aria-label="Filter by status">
            {statusFilters.map((filter) => (
              <button key={filter.value} className={`chip ${status === filter.value ? "is-on" : ""}`} onClick={() => setStatus(filter.value)} aria-pressed={status === filter.value}>
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="notice err">{error}</div>}

        <div className="card">
          {loading ? (
            <div className="card-b"><span className="skel" /></div>
          ) : runs && runs.length > 0 ? (
            <div className="tbl-wrap tbl-round">
              <table className="tbl">
                <thead><tr><th>Workflow</th><th>Status</th><th>Run type</th><th className="hide-m">Trigger</th><th className="hide-m">Started</th><th className="r">Duration</th></tr></thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className={run.status === "failed" ? "is-fail" : ""}>
                      <td>
                        <Link className="link-row" to={`/executions/${run.id}`}>{run.workflowName}</Link>
                        {run.error && <div className="small att-err trunc" title={run.error}>{run.error}</div>}
                      </td>
                      <td><StatusBadge status={run.status} /></td>
                      <td><span className={`badge ${run.mode === "live" ? "b-off" : "b-warn"}`}>{humanize(run.mode)}</span></td>
                      <td className="muted hide-m">{humanize(run.triggerType)}{run.startedBy && <div className="small dim">{run.startedBy}</div>}</td>
                      <td className="muted hide-m">{formatDate(run.createdAt)}</td>
                      <td className="r num">{formatDuration(run.startedAt, run.finishedAt)}</td>
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
