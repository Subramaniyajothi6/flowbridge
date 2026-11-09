import { Check, Clock, Loader2, Minus, RotateCcw, TriangleAlert, X } from "lucide-react";
import { Children, Fragment, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { PageHead, Shell } from "../components/Shell.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { formatDate, formatDuration, formatJson, humanize } from "../format.ts";
import type { RunDetail, StepRun, StepStatus } from "../types.ts";
import { useLoad } from "../useLoad.ts";
import { explainFailure } from "./failure-help.ts";

const TRIGGER = "__trigger";

function TimelineIcon({ status }: { status?: StepStatus }) {
  if (status === "succeeded") return <span className="tl-n ok"><Check size={13} aria-hidden="true" /></span>;
  if (status === "failed") return <span className="tl-n err"><X size={13} aria-hidden="true" /></span>;
  if (status === "running") return <span className="tl-n run"><Loader2 size={13} className="spin" aria-hidden="true" /></span>;
  if (status === "waiting") return <span className="tl-n wait"><Clock size={13} aria-hidden="true" /></span>;
  return <span className="tl-n skip"><Minus size={13} aria-hidden="true" /></span>;
}

export function ExecutionDetailPage() {
  const { id = "" } = useParams();
  const { data: run, error, reload } = useLoad(() => api.getRun(id), [id]);
  const [selected, setSelected] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const navigate = useNavigate();
  const { can } = useAuth();

  const isFinished = run?.status === "succeeded" || run?.status === "failed";

  useEffect(() => {
    if (!run || isFinished) return;
    // A waiting run changes rarely, so it is checked less often.
    const timer = setInterval(reload, run.status === "waiting" ? 5000 : 1500);
    return () => clearInterval(timer);
  }, [run, isFinished, reload]);

  // Opens on the step that needs attention, because that is usually why someone is looking.
  const attentionStepId = run?.steps.find((step) => step.status === "failed" || step.status === "waiting")?.stepId;
  const activeId = selected ?? attentionStepId ?? TRIGGER;

  async function retry(from: "failed" | "start") {
    setIsRetrying(true);
    setRetryError(null);
    try {
      const created = await api.retryRun(id, from);
      setSelected(null);
      navigate(`/executions/${created.id}`);
    } catch (problem) {
      setRetryError((problem as Error).message);
    } finally {
      setIsRetrying(false);
    }
  }

  if (error) return <Shell><div className="page"><div className="notice err">{error}</div></div></Shell>;
  if (!run) return <Shell><div className="page"><span className="skel" /></div></Shell>;

  return (
    <Shell>
      <div className="page">
        <div className="crumbs">
          <Link to="/executions">Executions</Link> / <b>{run.workflowName}</b>
        </div>
        <PageHead title={run.workflowName} subtitle={`${run.versionNumber === null ? "Test of a draft" : `Version ${run.versionNumber}`}. ${humanize(run.triggerType)} run on ${formatDate(run.createdAt)}${run.startedBy ? ` by ${run.startedBy}` : ""}.${run.finishedAt ? ` Took ${formatDuration(run.startedAt, run.finishedAt)}.` : ""}`}>
          <StatusBadge status={run.status} />
          {can("builder.view") && <Link className="btn" to={`/workflows/${run.workflowId}`}>Open workflow</Link>}
          {isFinished && can("runs.retry") && <button className="btn" disabled={isRetrying} onClick={() => retry("start")}>Run from start</button>}
          {run.status === "failed" && can("runs.retry") && (
            <button className="btn btn-p" disabled={isRetrying} onClick={() => retry("failed")}>
              <RotateCcw size={14} aria-hidden="true" /> Retry from failed step
            </button>
          )}
        </PageHead>

        {retryError && <div className="notice err" role="alert">{retryError}</div>}
        {run.retryOfRunId && <p className="small muted">This run is a retry. <Link to={`/executions/${run.retryOfRunId}`}>See the original run</Link></p>}
        {run.error && <FailureBanner run={run} />}

        <RunStrip run={run} activeId={activeId} isFinished={isFinished} onSelect={setSelected} />

        <div className="g-run">
          <div className="card" style={{ overflow: "hidden" }}>
            <button className={`tl-i ${activeId === TRIGGER ? "is-on" : ""}`} onClick={() => setSelected(TRIGGER)}>
              <TimelineIcon status="succeeded" />
              <span className="strong trunc">1. Trigger</span>
              <span className="small dim">{humanize(run.triggerType)}</span>
            </button>
            {run.definition.steps.map((step, index) => {
              const stepRun = run.steps.find((item) => item.stepId === step.id);
              return (
                <button key={step.id} className={`tl-i ${activeId === step.id ? "is-on" : ""} ${stepRun?.status === "failed" ? "is-fail" : ""}`} onClick={() => setSelected(step.id)}>
                  <TimelineIcon status={stepRun?.status} />
                  <span className="strong trunc">{stepNumber(index)}. {step.name}</span>
                  <span className="small dim num">{stepRun ? formatDuration(stepRun.startedAt, stepRun.finishedAt) : "Not reached"}</span>
                </button>
              );
            })}
          </div>

          {activeId === TRIGGER ? (
            <DataCard title="Trigger data" sections={can("runs.viewStepData") ? [["Data received", run.triggerData]] : []} />
          ) : (
            <StepDetail runId={run.id} name={run.definition.steps.find((step) => step.id === activeId)?.name ?? activeId} stepRun={run.steps.find((item) => item.stepId === activeId)} onDecided={reload} />
          )}
        </div>
      </div>
    </Shell>
  );
}

// The trigger is step 1, so the first real step is step 2.
function stepNumber(index: number): number {
  return index + 2;
}

function FailureBanner({ run }: { run: RunDetail }) {
  const failedRun = run.steps.find((step) => step.status === "failed");
  const failedIndex = run.definition.steps.findIndex((step) => step.id === failedRun?.stepId);
  const heading = failedIndex >= 0
    ? `Step ${stepNumber(failedIndex)}, ${run.definition.steps[failedIndex].name}, failed`
    : "This run failed";
  const help = explainFailure(failedRun?.error ?? run.error ?? "");

  return (
    <section className="notice err failure-banner" role="alert">
      <TriangleAlert size={17} aria-hidden="true" />
      <div className="grow col" style={{ gap: 3 }}>
        <strong className="failure-title">{heading}</strong>
        <span>{help.explanation}</span>
        <span><strong>Next step:</strong> {help.nextStep}</span>
      </div>
    </section>
  );
}

const WAIT_LABELS = { delay: "Waiting", approval: "Needs a decision", retry: "Will retry" };

function stripAppearance(stepRun: StepRun | undefined, isFinished: boolean): { className: string; detail: string } {
  if (!stepRun) return isFinished ? { className: "skip", detail: "Not run" } : { className: "wait", detail: "Waiting" };
  if (stepRun.status === "succeeded") return { className: "ok", detail: formatDuration(stepRun.startedAt, stepRun.finishedAt) };
  if (stepRun.status === "failed") return { className: "err", detail: "Failed" };
  if (stepRun.status === "running") return { className: "running", detail: "Running" };
  if (stepRun.status === "waiting") return { className: "retry", detail: WAIT_LABELS[stepRun.waitKind ?? "delay"] };
  return { className: "skip", detail: "Skipped" };
}

// Drawn from the version the run used, so later edits do not change this picture.
function RunStrip({ run, activeId, isFinished, onSelect }: { run: RunDetail; activeId: string; isFinished: boolean; onSelect: (id: string) => void }) {
  return (
    <section className="rp" aria-label="Steps in this run">
      <div className="row" style={{ gap: 10 }}>
        <strong className="rp-title">Run path</strong>
        <span className="small rp-sub">Select a step to see what happened</span>
      </div>
      <div className="rp-track">
        <button className={`rp-n ok ${activeId === TRIGGER ? "is-on" : ""}`} aria-pressed={activeId === TRIGGER} onClick={() => onSelect(TRIGGER)}>
          <span className="trunc">Trigger</span>
          <small>{humanize(run.triggerType)}</small>
        </button>
        {run.definition.steps.map((step) => {
          const stepRun = run.steps.find((item) => item.stepId === step.id);
          const { className, detail } = stripAppearance(stepRun, isFinished);
          return (
            <Fragment key={step.id}>
              <span className="rp-c"><i style={{ width: stepRun ? "100%" : 0 }} /></span>
              <button className={`rp-n ${className} ${activeId === step.id ? "is-on" : ""}`} aria-pressed={activeId === step.id} onClick={() => onSelect(step.id)}>
                <span className="trunc">{step.name}</span>
                <small>{detail}</small>
              </button>
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

function StepDetail({ runId, name, stepRun, onDecided }: { runId: string; name: string; stepRun?: StepRun; onDecided: () => Promise<void> }) {
  const { can } = useAuth();

  if (!stepRun) {
    return <div className="card card-b muted">{name} was not reached in this run.</div>;
  }
  // A role without access to step data still sees what happened, just not the data.
  const sections: [string, unknown][] = can("runs.viewStepData") ? [["Input", stepRun.input]] : [];
  if (stepRun.status === "succeeded" && can("runs.viewStepData")) sections.push(["Output", stepRun.output]);

  return (
    <DataCard title={name} status={stepRun.status} attempt={stepRun.attempt} error={stepRun.error} sections={sections}>
      {stepRun.status === "waiting" && stepRun.waitKind === "approval" && (can("approvals.decide")
        ? <ApprovalBox runId={runId} stepRun={stepRun} onDecided={onDecided} />
        : <div className="notice warn">Waiting for someone to approve or reject this.</div>)}
      {stepRun.status === "waiting" && stepRun.waitKind === "delay" && <div className="notice info">Waiting until {formatDate(stepRun.resumeAt)}.</div>}
      {stepRun.status === "waiting" && stepRun.waitKind === "retry" && <div className="notice warn">Will try again at {formatDate(stepRun.resumeAt)}.</div>}
      {stepRun.attemptLog.length > 0 && <AttemptLog attempts={stepRun.attemptLog} />}
    </DataCard>
  );
}

function ApprovalBox({ runId, stepRun, onDecided }: { runId: string; stepRun: StepRun; onDecided: () => Promise<void> }) {
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const message = (stepRun.input as { message?: unknown } | null)?.message;

  async function decide(approved: boolean) {
    setIsSending(true);
    setProblem(null);
    try {
      await api.decideApproval(runId, stepRun.stepId, approved, note);
      await onDecided();
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="approval-box">
      <strong>Your decision is needed</strong>
      <p className="pre-wrap">{String(message ?? "")}</p>
      <p className="small muted">If nobody decides by {formatDate(stepRun.resumeAt)}, this step fails.</p>
      <div className="field">
        <label className="label" htmlFor="decision-note">Note (optional)</label>
        <input id="decision-note" className="input" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      {problem && <div className="notice err" role="alert">{problem}</div>}
      <div className="row">
        <button className="btn btn-p" disabled={isSending} onClick={() => decide(true)}>Approve</button>
        <button className="btn" disabled={isSending} onClick={() => decide(false)}>Reject</button>
      </div>
    </div>
  );
}

function AttemptLog({ attempts }: { attempts: StepRun["attemptLog"] }) {
  return (
    <div className="field">
      <span className="label">What each attempt saw</span>
      <div className="attempts">
        {attempts.map((attempt) => (
          <div className="attempt" key={attempt.attempt}>
            <strong>Attempt {attempt.attempt}</strong>
            <span className="small muted">{formatDate(attempt.at)}</span>
            <span className="grow mono small pre-wrap">{attempt.error}</span>
            <span className="small dim">{attempt.retryInSeconds === null ? "Stopped" : `Waited ${attempt.retryInSeconds} s`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataCard({ title, status, attempt, error, sections, children }: { title: string; status?: StepStatus; attempt?: number; error?: string | null; sections: [string, unknown][]; children?: ReactNode }) {
  return (
    <div className="card">
      <div className="card-h">
        <h2 className="card-t">{title}</h2>
        <div className="row">
          {attempt !== undefined && attempt > 1 && <span className="small muted">Attempt {attempt}</span>}
          {status && <StatusBadge status={status} />}
        </div>
      </div>
      <div className="card-b col" style={{ gap: 12 }}>
        {error && <div className="notice err pre-wrap">{error}</div>}
        {children}
        {sections.length === 0 && Children.toArray(children).length === 0 && !error && <p className="muted">Your role can see that this step ran, but not the data it used.</p>}
        {sections.map(([label, value]) => (
          <div className="field" key={label}>
            <span className="label">{label}</span>
            <pre className="code tall">{formatJson(value) || "No data"}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
