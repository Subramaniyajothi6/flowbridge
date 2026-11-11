import { Download, History } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { DesignIcon } from "../components/DesignIcon.tsx";
import { Pager } from "../components/Pager.tsx";
import { PageHead, Shell } from "../components/Shell.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { formatDuration, formatNumber, formatRelative, humanize } from "../format.ts";
import type { RunFilters, RunListItem, StepProgress } from "../types.ts";
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

const dateRanges = [
  { value: "today", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

// The most rows one CSV download holds.
const CSV_LIMIT = 1000;

// The start of the chosen period, worked out in the person's own browser so "Today" means their day.
function sinceFor(range: string): string | undefined {
  if (range === "all") return undefined;
  if (range === "today") {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return midnight.toISOString();
  }
  return new Date(Date.now() - Number(range) * 86_400_000).toISOString();
}

// A leading = or + would make a spreadsheet treat the value as a formula.
function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

function downloadCsv(runs: RunListItem[]) {
  const header = ["Workflow", "Status", "Run type", "Version", "Trigger", "Started", "Duration", "Failed at", "Error"];
  const rows = runs.map((run) => [
    run.workflowName,
    run.status,
    run.mode,
    run.versionNumber === null ? "" : String(run.versionNumber),
    run.triggerType,
    run.createdAt,
    formatDuration(run.startedAt, run.finishedAt),
    run.failedStepName ?? "",
    run.error ?? "",
  ]);
  const text = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  link.download = "flowbridge-executions.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

const segmentClass: Record<StepProgress, string> = {
  succeeded: "ok",
  failed: "err",
  running: "run",
  waiting: "run",
  skipped: "skip",
  not_reached: "",
};

// What the little step bar means, for the tooltip and screen readers.
function describeProgress(run: RunListItem): string {
  const total = run.steps.length;
  if (total === 0) return "No steps";
  const failedAt = run.steps.indexOf("failed");
  if (failedAt >= 0) return `Failed at step ${failedAt + 1} of ${total}`;
  const activeAt = run.steps.findIndex((step) => step === "running" || step === "waiting");
  if (activeAt >= 0) return `${run.steps[activeAt] === "waiting" ? "Waiting at" : "Running"} step ${activeAt + 1} of ${total}`;
  const done = run.steps.filter((step) => step === "succeeded").length;
  return done === total ? `All ${total} ${total === 1 ? "step" : "steps"} succeeded` : `${done} of ${total} steps ran`;
}

function StepBar({ run }: { run: RunListItem }) {
  const label = describeProgress(run);
  return (
    <span className="trace" title={label} role="img" aria-label={label}>
      {run.steps.map((step, index) => <i key={index} className={`seg ${segmentClass[step]}`} />)}
    </span>
  );
}

export function ExecutionsPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("live");
  const [workflowId, setWorkflowId] = useState("");
  const [dateRange, setDateRange] = useState("30");
  const [page, setPage] = useState(1);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const filters = (): RunFilters => ({ status: status || undefined, mode: mode || undefined, workflowId: workflowId || undefined, since: sinceFor(dateRange), page });
  const { data: result, error, loading, reload } = useLoad(() => api.listRuns(filters()), [status, mode, workflowId, dateRange, page]);
  const totals = useLoad(() => api.analytics(30));
  const workflows = useLoad(api.listWorkflows);
  const runs = result?.items;

  const hasActiveRun = runs?.some((run) => run.status === "queued" || run.status === "running");

  useEffect(() => {
    if (!hasActiveRun) return;
    const timer = setInterval(reload, 3000);
    return () => clearInterval(timer);
  }, [hasActiveRun, reload]);

  // Any change of filter starts again from the first page.
  function filterBy(change: () => void) {
    change();
    setPage(1);
  }

  async function retry(run: RunListItem) {
    setRetryingId(run.id);
    setNotice(null);
    try {
      await api.retryRun(run.id, "failed");
      setNotice({ kind: "ok", text: `Retrying ${run.workflowName} from the failed step. The new run is at the top of the list.` });
      setPage(1);
      await reload();
    } catch (problem) {
      setNotice({ kind: "err", text: (problem as Error).message });
    } finally {
      setRetryingId(null);
    }
  }

  // Downloads every run that matches the filters, not only this page, up to a limit.
  async function exportCsv() {
    setIsExporting(true);
    try {
      const all = await api.listRuns({ ...filters(), page: 1, pageSize: CSV_LIMIT });
      downloadCsv(all.items);
      if (all.total > CSV_LIMIT) setNotice({ kind: "ok", text: `The download has the newest ${formatNumber(CSV_LIMIT)} of ${formatNumber(all.total)} runs. Narrow the dates or workflow to get the rest.` });
    } catch (problem) {
      setNotice({ kind: "err", text: (problem as Error).message });
    } finally {
      setIsExporting(false);
    }
  }

  const canRetry = can("runs.retry");
  const isFiltered = status !== "" || workflowId !== "" || dateRange !== "30";

  return (
    <Shell>
      <div className="page">
        <PageHead title="Executions" subtitle="Every workflow run, and which step it reached. Totals count live runs only, so testing never skews your numbers.">
          <button className="btn" disabled={!result?.total || isExporting} onClick={exportCsv}><Download size={14} aria-hidden="true" /> {isExporting ? "Preparing" : "Export CSV"}</button>
        </PageHead>

        {totals.data && (
          <section className="card stats" aria-label="Last 30 days">
            <div className="stat"><span className="stat-l"><span className="dot" />Total live executions</span><span className="stat-v">{formatNumber(totals.data.totals.total)}</span></div>
            <div className="stat"><span className="stat-l"><span className="dot ok" />Successful</span><span className="stat-v">{formatNumber(totals.data.totals.succeeded)}</span></div>
            <div className="stat"><span className="stat-l"><span className="dot err" />Failed</span><span className="stat-v">{formatNumber(totals.data.totals.failed)}</span></div>
            <div className="stat"><span className="stat-l"><span className="dot run" />Running now</span><span className="stat-v">{formatNumber(totals.data.totals.active)}</span></div>
          </section>
        )}

        <div className="row wrap">
          <div className="seg-ctl" role="group" aria-label="Run type">
            {modes.map((item) => (
              <button key={item.value} className={mode === item.value ? "is-on" : ""} aria-pressed={mode === item.value} onClick={() => filterBy(() => setMode(item.value))}>{item.label}</button>
            ))}
          </div>
          <div className="row wrap" role="group" aria-label="Filter by status">
            {statusFilters.map((filter) => (
              <button key={filter.value} className={`chip ${status === filter.value ? "is-on" : ""}`} onClick={() => filterBy(() => setStatus(filter.value))} aria-pressed={status === filter.value}>
                {filter.label}
              </button>
            ))}
          </div>
          <div className="grow" />
          {workflows.data && (
            <>
              <label className="small muted" htmlFor="run-workflow">Workflow</label>
              <select id="run-workflow" className="select run-workflow" value={workflowId} onChange={(event) => filterBy(() => setWorkflowId(event.target.value))}>
                <option value="">All workflows</option>
                {[...workflows.data].sort((first, second) => first.name.localeCompare(second.name)).map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>{workflow.name}</option>
                ))}
              </select>
            </>
          )}
          <label className="small muted" htmlFor="run-date">Date</label>
          <select id="run-date" className="select run-date" value={dateRange} onChange={(event) => filterBy(() => setDateRange(event.target.value))}>
            {dateRanges.map((range) => <option key={range.value} value={range.value}>{range.label}</option>)}
          </select>
        </div>

        {error && <div className="notice err">{error}</div>}
        {notice && <div className={`notice ${notice.kind}`} role="status">{notice.text}</div>}

        <div className="card">
          {loading ? (
            <div className="card-b"><span className="skel" /></div>
          ) : runs && runs.length > 0 ? (
            <div className="tbl-wrap tbl-round">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Workflow</th>
                    <th className="hide-m">Run type</th>
                    <th className="hide-m">Trigger</th>
                    <th className="hide-m">Steps</th>
                    <th>Status</th>
                    <th className="hide-m">Started</th>
                    <th className="r hide-m">Duration</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const showRetry = canRetry && run.status === "failed" && run.mode === "live";
                    return (
                      <tr key={run.id} className={run.status === "failed" ? "is-fail" : ""}>
                        <td>
                          <Link className="link-row" to={`/executions/${run.id}`}>{run.workflowName}</Link>
                          {run.status === "failed" && (
                            <div className="small att-err trunc" title={run.error ?? undefined}>
                              {run.failedStepName ? `Failed at ${run.failedStepName}` : run.error}
                            </div>
                          )}
                        </td>
                        <td className="hide-m">
                          <span className={`badge ${run.mode === "live" ? "b-off" : "b-test"}`}>{humanize(run.mode)}</span>
                          <div className="small dim">{run.versionNumber === null ? "Draft" : `Version ${run.versionNumber}`}</div>
                        </td>
                        <td className="muted hide-m">{humanize(run.triggerType)}{run.startedBy && <div className="small dim">{run.startedBy}</div>}</td>
                        <td className="hide-m"><StepBar run={run} /></td>
                        <td><StatusBadge status={run.status} /></td>
                        <td className="muted hide-m nowrap">{formatRelative(run.createdAt, { exact: true })}</td>
                        <td className="r num hide-m">{formatDuration(run.startedAt, run.finishedAt)}</td>
                        <td className="r">
                          {showRetry ? (
                            <button className="btn btn-sm" disabled={retryingId === run.id} onClick={() => retry(run)}>
                              <DesignIcon name="retry" size={13} /> {retryingId === run.id ? "Retrying" : "Retry"}
                            </button>
                          ) : (
                            <Link className="btn btn-sm btn-g" to={`/executions/${run.id}`}>View</Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              <span className="empty-ic"><History size={20} aria-hidden="true" /></span>
              <strong>{isFiltered ? "No runs match these filters" : "No executions found"}</strong>
              <p className="muted">{isFiltered ? "Try a wider date range or another workflow." : "Runs appear here as soon as a workflow starts."}</p>
              {isFiltered && (
                <button className="btn" onClick={() => filterBy(() => { setStatus(""); setWorkflowId(""); setDateRange("30"); })}>Clear filters</button>
              )}
            </div>
          )}
        </div>

        {result && <Pager page={page} pageSize={result.pageSize} total={result.total} onChange={(number) => { setPage(number); window.scrollTo({ top: 0 }); }} />}
      </div>
    </Shell>
  );
}
