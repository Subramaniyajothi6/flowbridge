import { Check, Loader2, Minus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.ts";
import { definitionToFlow, statusMap } from "../builder/flow.ts";
import { WorkflowCanvas } from "../builder/WorkflowCanvas.tsx";
import { PageHead, Shell } from "../components/Shell.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { formatDate, formatDuration, formatJson, humanize } from "../format.ts";
import type { RunDetail, StepRun, StepStatus } from "../types.ts";
import { useLoad } from "../useLoad.ts";

const TRIGGER = "__trigger";

function TimelineIcon({ status }: { status?: StepStatus }) {
  if (status === "succeeded") return <span className="tl-n ok"><Check size={13} aria-hidden="true" /></span>;
  if (status === "failed") return <span className="tl-n err"><X size={13} aria-hidden="true" /></span>;
  if (status === "running") return <span className="tl-n run"><Loader2 size={13} className="spin" aria-hidden="true" /></span>;
  return <span className="tl-n skip"><Minus size={13} aria-hidden="true" /></span>;
}

export function ExecutionDetailPage() {
  const { id = "" } = useParams();
  const { data: run, error, reload } = useLoad(() => api.getRun(id), [id]);
  const [selected, setSelected] = useState<string | null>(null);

  const isFinished = run?.status === "succeeded" || run?.status === "failed";

  useEffect(() => {
    if (!run || isFinished) return;
    const timer = setInterval(reload, 1500);
    return () => clearInterval(timer);
  }, [run, isFinished, reload]);

  // Opens on the step that failed, because that is usually why someone is looking.
  const failedStepId = run?.steps.find((step) => step.status === "failed")?.stepId;
  const activeId = selected ?? failedStepId ?? TRIGGER;

  if (error) return <Shell><div className="page"><div className="notice err">{error}</div></div></Shell>;
  if (!run) return <Shell><div className="page"><span className="skel" /></div></Shell>;

  return (
    <Shell>
      <div className="page">
        <div className="crumbs">
          <Link to="/executions">Executions</Link> / <b>{run.workflowName}</b>
        </div>
        <PageHead title={run.workflowName} subtitle={`Version ${run.versionNumber}. Started by ${humanize(run.triggerType).toLowerCase()} on ${formatDate(run.createdAt)}. Took ${formatDuration(run.startedAt, run.finishedAt)}.`}>
          <StatusBadge status={run.status} />
          <Link className="btn" to={`/workflows/${run.workflowId}`}>Open workflow</Link>
        </PageHead>

        {run.error && <div className="notice err">{run.error}</div>}

        <RunGraph run={run} onSelect={setSelected} />

        <div className="g-run">
          <div className="card" style={{ overflow: "hidden" }}>
            <button className={`tl-i ${activeId === TRIGGER ? "is-on" : ""}`} onClick={() => setSelected(TRIGGER)}>
              <TimelineIcon status="succeeded" />
              <span className="strong trunc">Trigger</span>
              <span className="small dim">{humanize(run.triggerType)}</span>
            </button>
            {run.definition.steps.map((step) => {
              const stepRun = run.steps.find((item) => item.stepId === step.id);
              return (
                <button key={step.id} className={`tl-i ${activeId === step.id ? "is-on" : ""} ${stepRun?.status === "failed" ? "is-fail" : ""}`} onClick={() => setSelected(step.id)}>
                  <TimelineIcon status={stepRun?.status} />
                  <span className="strong trunc">{step.name}</span>
                  <span className="small dim num">{stepRun ? formatDuration(stepRun.startedAt, stepRun.finishedAt) : "Not reached"}</span>
                </button>
              );
            })}
          </div>

          {activeId === TRIGGER ? (
            <DataCard title="Trigger data" sections={[["Data received", run.triggerData]]} />
          ) : (
            <StepDetail name={run.definition.steps.find((step) => step.id === activeId)?.name ?? activeId} stepRun={run.steps.find((item) => item.stepId === activeId)} />
          )}
        </div>
      </div>
    </Shell>
  );
}

// Drawn from the version the run used, so later edits do not change this picture.
function RunGraph({ run, onSelect }: { run: RunDetail; onSelect: (id: string) => void }) {
  const flow = useMemo(() => definitionToFlow(run.definition, humanize(run.triggerType)), [run.definition, run.triggerType]);
  const statuses = useMemo(() => statusMap(run.steps), [run.steps]);

  return (
    <div className="run-canvas">
      <WorkflowCanvas readOnly nodes={flow.nodes} edges={flow.edges} statuses={statuses} onSelect={(id) => onSelect(id ?? TRIGGER)} />
    </div>
  );
}

function StepDetail({ name, stepRun }: { name: string; stepRun?: StepRun }) {
  if (!stepRun) {
    return <div className="card card-b muted">{name} was not reached in this run.</div>;
  }
  const sections: [string, unknown][] = [["Input", stepRun.input]];
  if (stepRun.status === "succeeded") sections.push(["Output", stepRun.output]);

  return (
    <DataCard title={name} status={stepRun.status} attempt={stepRun.attempt} error={stepRun.error} sections={sections} />
  );
}

function DataCard({ title, status, attempt, error, sections }: { title: string; status?: StepStatus; attempt?: number; error?: string | null; sections: [string, unknown][] }) {
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
