import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { PageHead, Shell } from "../components/Shell.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { formatDate, formatNumber, formatPercent } from "../format.ts";
import type { Health, Overview } from "../types.ts";
import { useLoad } from "../useLoad.ts";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  return hour < 18 ? "Good afternoon" : "Good evening";
}

export function OverviewPage() {
  const { session, can } = useAuth();
  const { data, error, reload } = useLoad(api.overview);
  const firstName = session?.user.name.split(" ")[0] ?? "";

  const attentionCount = data?.attention.length ?? 0;
  const subtitle = attentionCount > 0 ? `${attentionCount} ${attentionCount === 1 ? "item needs" : "items need"} your attention.` : "Everything is running well.";

  return (
    <Shell>
      <div className="page">
        <PageHead title={`${greeting()}, ${firstName}`} subtitle={data ? subtitle : undefined}>
          {can("workflows.edit") && <Link className="btn btn-p" to="/workflows">Create workflow</Link>}
        </PageHead>

        {error && <div className="notice err">{error}</div>}
        {!data && !error && <span className="skel" />}

        {data && (
          <>
            <section className="card stats" aria-label="Summary">
              <Stat label="Total workflows" value={formatNumber(data.workflows.total)} detail={`${data.workflows.drafts} drafts`} />
              <Stat label="Published" value={formatNumber(data.workflows.published)} detail={`${data.runs.active} in progress`} />
              <Stat label="Successful runs" value={formatNumber(data.runs.succeeded)} detail="Last 30 days" />
              <Stat label="Failed runs" value={formatNumber(data.runs.failed)} detail="Last 30 days" />
              <Stat label="Success rate" value={formatPercent(data.runs.succeeded, data.runs.succeeded + data.runs.failed)} detail="Finished runs" />
            </section>

            {/* Two rows of two cards, so the cards side by side start and end level. */}
            <div className="g-21 overview-rows">
              <AttentionCard items={data.attention} canRetry={can("runs.retry")} onChanged={reload} />

              <section className="card">
                <div className="card-h"><h2 className="card-t">Most used workflows</h2></div>
                <div className="card-b col" style={{ gap: 8 }}>
                  {data.mostUsed.length === 0 && <p className="muted">Nothing to show yet.</p>}
                  {data.mostUsed.map((workflow) => (
                    <div className="row between" key={workflow.id}>
                      <span className="trunc">{workflow.name}</span>
                      <span className="num small muted">{formatNumber(workflow.runs)}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* A role without System health gets the whole row, so no gap is left beside this. */}
              <section className={`card ${can("system.view") ? "" : "overview-wide"}`}>
                <div className="card-h"><h2 className="card-t">Recent executions</h2><Link className="small strong" to="/executions">View all</Link></div>
                {data.recent.length === 0 ? <p className="card-b muted">No live runs yet. Publish a workflow and run it.</p> : (
                  <div className="tbl-wrap tbl-round">
                    <table className="tbl">
                      <thead><tr><th>Workflow</th><th>Status</th><th className="r hide-m">Started</th></tr></thead>
                      <tbody>
                        {data.recent.map((run) => (
                          <tr key={run.id} className={run.status === "failed" ? "is-fail" : ""}>
                            <td><Link className="link-row" to={`/executions/${run.id}`}>{run.workflow_name}</Link></td>
                            <td><StatusBadge status={run.status} /></td>
                            <td className="r muted hide-m">{formatDate(run.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {can("system.view") && <HealthCard />}
            </div>

            <section className="card">
              <div className="card-h"><h2 className="card-t">Recent activity</h2></div>
              {data.activity.length === 0 && <p className="card-b muted">Nothing to show yet.</p>}
              {data.activity.map((item) => (
                <div className="activity-row" key={item.id}>
                  <span>{item.actorName} {item.description}</span>
                  <span className="small dim">{formatDate(item.createdAt)}</span>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </Shell>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="stat">
      <span className="stat-l">{label}</span>
      <span className="stat-v">{value}</span>
      <span className="stat-d">{detail}</span>
    </div>
  );
}

function AttentionCard({ items, canRetry, onChanged }: { items: Overview["attention"]; canRetry: boolean; onChanged: () => Promise<void> }) {
  const navigate = useNavigate();
  const [problem, setProblem] = useState<string | null>(null);

  async function retry(id: string) {
    try {
      const run = await api.retryRun(id, "failed");
      navigate(`/executions/${run.id}`);
    } catch (error) {
      setProblem((error as Error).message);
      await onChanged();
    }
  }

  return (
    <section className="card">
      <div className="card-h"><h2 className="card-t">Needs your attention</h2><Link className="small strong" to="/executions">All executions</Link></div>
      {problem && <div className="card-b"><div className="notice err" role="alert">{problem}</div></div>}
      {items.length === 0 ? (
        <div className="empty">
          <span className="empty-ic"><CircleCheck size={20} aria-hidden="true" /></span>
          <strong>Nothing needs you right now</strong>
          <p className="muted">Failed runs and approvals will appear here.</p>
        </div>
      ) : items.map((item) => (
        <div className="att-row" key={item.id}>
          <div className="grow">
            <div className="strong trunc">{item.workflow_name}</div>
            <div className={`small ${item.status === "failed" ? "att-err" : "muted"}`}>
              {item.status === "failed" ? item.error : `Waiting for a decision: ${String(item.message ?? "")}`}
            </div>
          </div>
          <Link className="btn btn-sm btn-g" to={`/executions/${item.id}`}>Review</Link>
          {canRetry && item.status === "failed" && <button className="btn btn-sm" onClick={() => retry(item.id)}>Retry</button>}
        </div>
      ))}
    </section>
  );
}

function HealthCard() {
  const { data } = useLoad<Health>(api.health);
  if (!data) return null;

  const problems = data.stuckRuns + data.brokenConnections.length + data.failingTriggers.length;

  return (
    <section className="card">
      <div className="card-h">
        <h2 className="card-t">System health</h2>
        <span className={`badge ${problems === 0 ? "b-ok" : "b-warn"}`}>{problems === 0 ? "Healthy" : `${problems} to check`}</span>
      </div>
      <div className="card-b col" style={{ gap: 8 }}>
        <HealthRow label="Database response" value={`${data.databaseMilliseconds} ms`} />
        <HealthRow label="Jobs in the queue" value={formatNumber(data.queuedJobs)} />
        <HealthRow label="Runs waiting" value={formatNumber(data.waitingRuns)} />
        <HealthRow label="Runs that look stuck" value={formatNumber(data.stuckRuns)} />
        <HealthRow label="Connections to reconnect" value={formatNumber(data.brokenConnections.length)} />
        <HealthRow label="Triggers with errors" value={formatNumber(data.failingTriggers.length)} />
      </div>
    </section>
  );
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return <div className="row between"><span className="muted">{label}</span><span className="num">{value}</span></div>;
}
