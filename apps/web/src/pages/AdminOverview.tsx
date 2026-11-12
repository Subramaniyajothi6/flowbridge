import { CircleCheck, Gauge, Plug, TriangleAlert, Users, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api.ts";
import { Figure, Meter, StatusDot } from "../components/Figures.tsx";
import { ROLE_LABELS } from "../auth.tsx";
import { formatNumber, formatPercent } from "../format.ts";
import type { AdminTask, Overview } from "../types.ts";
import { useLoad } from "../useLoad.ts";

// The top of Overview for Administrators: the workspace itself, rather than its workflows.

const TASK_ICONS: Record<AdminTask["kind"], { icon: typeof Plug; tone: string }> = {
  connection: { icon: Plug, tone: "tone-warn" },
  limit: { icon: TriangleAlert, tone: "tone-err" },
  usage: { icon: Gauge, tone: "tone-warn" },
  member: { icon: Users, tone: "tone-brand" },
};

export function AdminOverview({ overview }: { overview: Overview | null }) {
  const { data, error } = useLoad(api.adminOverview);

  if (error) return <div className="notice err">{error}</div>;
  if (!data || !overview) return <span className="skel" />;

  const usedShare = data.runs.limit > 0 ? (data.runs.used / data.runs.limit) * 100 : 0;
  const { workflows, runs } = overview;
  const finished = runs.succeeded + runs.failed;
  const okShare = finished > 0 ? (runs.succeeded / finished) * 100 : 0;

  return (
    <>
      <section className="card stats" aria-label="Workspace">
        <Figure label="Members" icon={Users} value={formatNumber(data.members.total)}>
          <StatusDot tone={data.members.notSignedIn === 0 ? "ok" : "warn"} />
          {data.members.notSignedIn === 0 ? "Everyone has signed in" : `${data.members.notSignedIn} not signed in yet`}
        </Figure>
        <Figure label="Connected apps" icon={Plug} value={formatNumber(data.connections.total)}>
          <StatusDot tone={data.connections.needAttention === 0 ? "ok" : "warn"} />
          {data.connections.needAttention === 0 ? "All working" : `${data.connections.needAttention} need attention`}
        </Figure>
        <Figure label="Runs used" icon={Gauge} value={formatNumber(data.runs.used)} picture={<Meter parts={[{ share: usedShare }]} label={`${Math.round(usedShare)}% of the monthly limit used`} />}>
          {Math.round(usedShare)}% of {formatNumber(data.runs.limit)} this month
        </Figure>
        <Figure label="Workflows" icon={Workflow} value={formatNumber(workflows.total)} picture={<Meter parts={[{ share: workflows.total > 0 ? (workflows.published / workflows.total) * 100 : 0 }]} label={`${workflows.published} of ${workflows.total} published`} />}>
          {workflows.published} published, {workflows.drafts} {workflows.drafts === 1 ? "draft" : "drafts"}
        </Figure>
        <Figure label="Success rate" icon={CircleCheck} value={formatPercent(runs.succeeded, finished)} picture={<Meter parts={[{ share: okShare, tone: "ok" }, { share: finished > 0 ? 100 - okShare : 0, tone: "bad" }]} label={`${runs.succeeded} succeeded and ${runs.failed} failed in the last 30 days`} />}>
          {runs.succeeded} succeeded, {runs.failed} failed
        </Figure>
      </section>

      <div className="g-21 overview-rows">
        <section className="card" aria-label="Needs an Administrator">
          <div className="card-h"><h2 className="card-t">Needs an Administrator</h2></div>
          {/* The standard empty state, which carries the design's flow lines. */}
          {data.tasks.length === 0 && (
            <div className="empty">
              <span className="empty-ic"><CircleCheck size={20} aria-hidden="true" /></span>
              <strong>Nothing needs an Administrator</strong>
              <p className="muted">Expiring connections, members who have not signed in and usage limits will appear here.</p>
            </div>
          )}
          {data.tasks.map((task) => {
            const { icon: Icon, tone } = TASK_ICONS[task.kind];
            return (
              <div className="ro-r" key={task.title}>
                <span className={`ro-sq ${tone}`}><Icon size={16} aria-hidden="true" /></span>
                <span className="ro-t">
                  <b>{task.title}</b>
                  <span>{task.detail}</span>
                </span>
                <Link className="btn btn-sm" to={task.href}>{task.action}</Link>
              </div>
            );
          })}
        </section>

        <section className="card" aria-label="Team by role">
          <div className="card-h"><h2 className="card-t">Team by role</h2><Link className="small strong" to="/team">Manage team</Link></div>
          {data.team.map((group) => (
            <div className="ro-r" key={group.role}>
              <span className="ro-t">
                <b>{ROLE_LABELS[group.role]}</b>
                <span>{group.people.length === 0 ? "Nobody yet" : group.people.map((person) => person.hasSignedIn ? person.name : `${person.name} (not signed in yet)`).join(", ")}</span>
              </span>
              <span className="num strong">{group.people.length}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
