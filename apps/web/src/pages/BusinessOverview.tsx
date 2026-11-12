import { History, Play, RotateCcw, TriangleAlert, UserCheck, Workflow as WorkflowIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { Figure, Meter, StatusDot } from "../components/Figures.tsx";
import { RunWorkflowDialog } from "../components/RunWorkflowDialog.tsx";
import { PageHead, Shell } from "../components/Shell.tsx";
import { formatNumber, formatRelative, formatTime } from "../format.ts";
import type { MyOverview, WorkflowSummary } from "../types.ts";
import { useLoad } from "../useLoad.ts";
import { greeting, RoleBanner } from "./overview-parts.tsx";

// Overview for people who use workflows rather than build them.
// It answers three questions: is anything waiting for me, did anything fail, and what can I run.

type Approval = MyOverview["approvals"][number];
type Failure = MyOverview["failures"][number];
type Decision = { approval: Approval; approved: boolean };
type Notice = { kind: "ok" | "err"; text: string };

const MOST_WORKFLOWS = 6;

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

// One line under the greeting, about the most important thing first.
function summary(data: MyOverview): string {
  if (data.approvals.length > 0) return `${plural(data.approvals.length, "decision is", "decisions are")} waiting for you.`;
  if (data.failureCount > 0) return `${plural(data.failureCount, "run", "runs")} did not finish this week.`;
  return "Everything you run is working.";
}

export function BusinessOverview() {
  const { session } = useAuth();
  const overview = useLoad(api.myOverview);
  const workflows = useLoad(api.listWorkflows);
  const [toRun, setToRun] = useState<WorkflowSummary | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const data = overview.data;
  const firstName = session?.user.name.split(" ")[0] ?? "";

  async function retry(failure: Failure) {
    setRetryingId(failure.id);
    setNotice(null);
    try {
      await api.retryRun(failure.id, "failed");
      setNotice({ kind: "ok", text: `Trying ${failure.workflowName} again from where it stopped. Follow it under Your recent runs.` });
      await overview.reload();
    } catch (problem) {
      setNotice({ kind: "err", text: (problem as Error).message });
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <Shell>
      <div className="page">
        <PageHead title={`${greeting()}, ${firstName}`} subtitle={data ? summary(data) : undefined} />
        <RoleBanner />

        <div role="status">{notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}</div>
        {overview.error && <div className="notice err">{overview.error}</div>}
        {!data && !overview.error && <span className="skel" />}

        {data && (
          <>
            <MyFigures data={data} />

            {/* Only shown when something is waiting. Otherwise the figures above already say all is well. */}
            {(data.approvals.length > 0 || data.failures.length > 0) && <NeedsYou data={data} retryingId={retryingId} onDecide={setDecision} onRetry={retry} />}
            <YourAutomations workflows={workflows.data} error={workflows.error} onRun={setToRun} />
            <WhatHappened data={data} />
          </>
        )}
      </div>

      {toRun && <RunWorkflowDialog workflow={toRun} onClose={() => setToRun(null)} />}
      {decision && (
        <DecisionDialog
          decision={decision}
          onClose={() => setDecision(null)}
          onDone={async (text) => {
            setDecision(null);
            setNotice({ kind: "ok", text });
            await overview.reload();
          }}
        />
      )}
    </Shell>
  );
}

function MyFigures({ data }: { data: MyOverview }) {
  const { succeeded, failed, active } = data.myWeek;
  const total = succeeded + failed + active;
  const finished = succeeded + failed;

  return (
    <section className="card stats" aria-label="At a glance">
      <Figure label="Waiting for you" icon={UserCheck} value={formatNumber(data.approvals.length)}>
        <StatusDot tone={data.approvals.length > 0 ? "warn" : "ok"} />
        {data.approvals.length > 0 ? "Decide below" : "Nothing to decide"}
      </Figure>
      <Figure label="Did not finish" icon={RotateCcw} value={formatNumber(data.failureCount)}>
        <StatusDot tone={data.failureCount > 0 ? "err" : "ok"} />
        {data.failureCount > 0 ? "In the last 7 days" : "Nothing failed this week"}
      </Figure>
      <Figure
        label="Your runs, 7 days"
        icon={Play}
        value={formatNumber(total)}
        picture={finished > 0 ? <Meter parts={[{ share: (succeeded / finished) * 100, tone: "ok" }, { share: (failed / finished) * 100, tone: "bad" }]} label={`${succeeded} succeeded and ${failed} failed`} /> : undefined}
      >
        {total === 0 ? "You have not run anything this week" : `${succeeded} succeeded, ${failed} failed${active > 0 ? `, ${active} running` : ""}`}
      </Figure>
    </section>
  );
}

function NeedsYou({ data, retryingId, onDecide, onRetry }: { data: MyOverview; retryingId: string | null; onDecide: (decision: Decision) => void; onRetry: (failure: Failure) => void }) {
  return (
    <section className="card" aria-label="Needs you">
      <div className="card-h">
        <h2 className="card-t">Needs you</h2>
        {data.failureCount > data.failures.length && <Link className="small strong" to="/executions">See all</Link>}
      </div>

      {data.approvals.length > 0 && <div className="needs-h">Waiting for your decision</div>}
      {data.approvals.map((approval) => (
        <div className="ro-r needs-r" key={`${approval.runId}:${approval.stepId}`}>
          <span className="ro-sq tone-warn"><UserCheck size={16} aria-hidden="true" /></span>
          <span className="ro-t">
            <b>{approval.workflowName}{approval.stepName && <span className="needs-step"> · {approval.stepName}</span>}</b>
            {approval.message && <span className="needs-message">"{approval.message}"</span>}
            <span>Waiting since {formatRelative(approval.waitingSince)}{approval.decideBy && `. Decide by ${formatRelative(approval.decideBy)}`}</span>
          </span>
          <div className="row needs-actions">
            <button className="btn btn-sm" onClick={() => onDecide({ approval, approved: false })}>Reject</button>
            <button className="btn btn-sm btn-p" onClick={() => onDecide({ approval, approved: true })}>Approve</button>
          </div>
        </div>
      ))}

      {data.failures.length > 0 && <div className="needs-h">Did not finish</div>}
      {data.failures.map((failure) => (
        <div className="ro-r needs-r" key={failure.id}>
          <span className="ro-sq tone-err"><TriangleAlert size={16} aria-hidden="true" /></span>
          <span className="ro-t">
            <b>{failure.workflowName}</b>
            <span className="needs-reason">{failure.reason}</span>
            <span>{failure.retryHelps ? "Trying again usually works." : "Ask a Workflow Builder to fix this first. Trying again now will probably fail the same way."} {formatRelative(failure.createdAt)}.</span>
          </span>
          <div className="row needs-actions">
            <Link className="btn btn-sm btn-g" to={`/executions/${failure.id}`}>Details</Link>
            <button className={`btn btn-sm ${failure.retryHelps ? "" : "btn-g"}`} disabled={retryingId === failure.id} onClick={() => onRetry(failure)}>
              <RotateCcw size={13} aria-hidden="true" /> {retryingId === failure.id ? "Starting" : "Try again"}
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

// How the last run went, in a few words, with a coloured dot.
function lastRunText(workflow: WorkflowSummary): { text: string; tone: string } {
  const last = workflow.lastRun;
  if (!last) return { text: "Not run yet", tone: "" };
  if (last.status === "queued" || last.status === "running") return { text: "Last run: running now", tone: "run" };
  if (last.status === "waiting") return { text: "Last run: waiting", tone: "warn" };
  const when = formatRelative(last.createdAt);
  return last.status === "failed" ? { text: `Last run: ${when}, did not finish`, tone: "err" } : { text: `Last run: ${when}`, tone: "ok" };
}

function YourAutomations({ workflows, error, onRun }: { workflows: WorkflowSummary[] | null; error: string | null; onRun: (workflow: WorkflowSummary) => void }) {
  const shown = (workflows ?? []).slice(0, MOST_WORKFLOWS);

  return (
    <section className="card" aria-label="Your automations">
      <div className="card-h">
        <h2 className="card-t">Your automations</h2>
        {(workflows?.length ?? 0) > MOST_WORKFLOWS && <Link className="small strong" to="/workflows">See all</Link>}
      </div>
      {error && <div className="card-b"><div className="notice err">{error}</div></div>}
      {!workflows && !error && <div className="card-b"><span className="skel" /></div>}
      {workflows && workflows.length === 0 && (
        <div className="empty">
          <span className="empty-ic"><WorkflowIcon size={20} aria-hidden="true" /></span>
          <strong>Nothing to run yet</strong>
          <p className="muted">Automations appear here once a Workflow Builder publishes them.</p>
        </div>
      )}
      {shown.length > 0 && (
        <div className="auto-grid">
          {shown.map((workflow) => {
            const last = lastRunText(workflow);
            const about = workflow.description || (workflow.inputFields.length > 0 ? `Asks for ${workflow.inputFields.map((field) => field.name).join(", ")}.` : `${plural(workflow.stepCount, "step", "steps")}: ${workflow.stepNames.slice(0, 3).join(", ")}.`);
            return (
              <article className="auto-card" key={workflow.id}>
                <h3 className="auto-name">{workflow.name}</h3>
                <p className="auto-about">{about}</p>
                <div className="auto-foot">
                  <span className="small muted auto-last"><span className={`dot ${last.tone}`} aria-hidden="true" /> {last.text}</span>
                  <button className="btn btn-sm" onClick={() => onRun(workflow)}><Play size={13} aria-hidden="true" /> Run now</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

// The day told as sentences: what finished, what is running, what stopped and why.
function WhatHappened({ data }: { data: MyOverview }) {
  const title = data.storyIsToday ? "What happened today" : "Recently";

  return (
    <section className="card" aria-label={title}>
      <div className="card-h"><h2 className="card-t">{title}</h2>{data.story.length > 0 && <Link className="small strong" to="/executions">All runs</Link>}</div>
      {data.story.length === 0 ? (
        <div className="empty">
          <span className="empty-ic"><History size={20} aria-hidden="true" /></span>
          <strong>Nothing has run yet</strong>
          <p className="muted">When automations run, each one is described here in a sentence.</p>
        </div>
      ) : data.story.map((item) => (
        <Link className="story-row" to={`/executions/${item.id}`} key={item.id}>
          <span className={`dot ${item.tone}`} aria-hidden="true" />
          <span className="grow">
            {item.text}
            {item.startedByYou && <span className="story-you">You started this</span>}
          </span>
          <span className="small muted story-time">{data.storyIsToday ? formatTime(item.at) : formatRelative(item.at)}</span>
        </Link>
      ))}
    </section>
  );
}

// Approving or rejecting cannot be undone, so the choice is confirmed here, with room for a note.
function DecisionDialog({ decision, onClose, onDone }: { decision: Decision; onClose: () => void; onDone: (text: string) => Promise<void> }) {
  const { approval, approved } = decision;
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function confirm() {
    setIsSending(true);
    try {
      await api.decideApproval(approval.runId, approval.stepId, approved, note.trim());
      await onDone(approved ? `Approved. ${approval.workflowName} carries on.` : `Rejected. ${approval.workflowName} takes its rejected path.`);
    } catch (failure) {
      setProblem((failure as Error).message);
      setIsSending(false);
    }
  }

  return (
    <div className="scrim">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="decision-title">
        <h2 id="decision-title">{approved ? "Approve this request?" : "Reject this request?"}</h2>
        <p className="muted">{approval.workflowName}{approval.stepName ? `, ${approval.stepName}` : ""}</p>
        {approval.message && <blockquote className="decision-quote">{approval.message}</blockquote>}
        <div className="field">
          <label className="label" htmlFor="decision-note">Note (optional)</label>
          <input id="decision-note" className="input" maxLength={500} autoFocus placeholder={approved ? "For example: Checked with the customer" : "For example: Amount is too high"} value={note} onChange={(event) => setNote(event.target.value)} />
          <span className="hint">Saved with the run, so others can see why.</span>
        </div>
        {problem && <p className="err-msg" role="alert">{problem}</p>}
        <div className="modal-a">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className={`btn ${approved ? "btn-p" : "btn-d"}`} disabled={isSending} onClick={confirm}>{isSending ? "Saving..." : approved ? "Approve" : "Reject"}</button>
        </div>
      </div>
    </div>
  );
}
