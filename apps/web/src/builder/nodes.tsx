import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Check, Loader2, X } from "lucide-react";
import { createContext, useContext } from "react";
import { StepIcon, TriggerIcon } from "../components/StepIcon.tsx";
import { humanize } from "../format.ts";
import type { StepStatus, WorkflowStep } from "../types.ts";
import type { FlowNode } from "./flow.ts";

// The status of each step in the run being shown. Kept apart from the nodes,
// so that watching a run never counts as editing the workflow.
export const StepStatusContext = createContext<Map<string, StepStatus>>(new Map());

const statusClass: Record<StepStatus, string> = {
  running: "running",
  succeeded: "x-ok",
  failed: "x-err",
  skipped: "x-skip",
};

function describe(step: WorkflowStep): string {
  if (step.type === "connector") return humanize(step.config.action);
  if (step.type === "if") return "If / else";
  return `${step.config.method} request`;
}

function StatusMark({ status }: { status?: StepStatus }) {
  if (status === "succeeded") return <span className="node-x ok"><Check size={11} aria-hidden="true" /></span>;
  if (status === "failed") return <span className="node-x err"><X size={11} aria-hidden="true" /></span>;
  if (status === "running") return <span className="node-x run"><Loader2 size={11} className="spin" aria-hidden="true" /></span>;
  return null;
}

export function StepNode({ data, selected }: NodeProps<FlowNode>) {
  const step = data.step as WorkflowStep;
  const status = useContext(StepStatusContext).get(step.id);

  return (
    <div className={`node ${selected ? "is-sel" : ""} ${status ? statusClass[status] : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-b">
        <StepIcon step={step} />
        <span className="grow">
          <span className="node-t trunc">{step.name}</span>
          <span className="node-d trunc">{describe(step)}</span>
        </span>
      </div>
      <div className="node-f">
        <span className="mono trunc">{status ? humanize(status) : step.id}</span>
      </div>
      <StatusMark status={status} />

      {step.type === "if" ? (
        <>
          <Handle id="true" type="source" position={Position.Right} style={{ top: "30%" }} />
          <Handle id="false" type="source" position={Position.Right} style={{ top: "70%" }} />
          <span className="handle-label" style={{ top: "30%" }}>True</span>
          <span className="handle-label" style={{ top: "70%" }}>False</span>
        </>
      ) : (
        <Handle id="success" type="source" position={Position.Right} />
      )}
    </div>
  );
}

export function TriggerNode({ data, selected }: NodeProps<FlowNode>) {
  return (
    <div className={`node is-trig ${selected ? "is-sel" : ""}`}>
      <div className="node-b">
        <TriggerIcon />
        <span className="grow">
          <span className="node-t trunc">Trigger</span>
          <span className="node-d trunc">{data.summary}</span>
        </span>
      </div>
      <div className="node-f"><span className="trunc">Starts the workflow</span></div>
      <Handle id="start" type="source" position={Position.Right} />
    </div>
  );
}

export const nodeTypes = { step: StepNode, trigger: TriggerNode };
