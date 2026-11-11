import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Check, Clock, Loader2, X } from "lucide-react";
import { createContext, useContext } from "react";
import { DesignIcon } from "../components/DesignIcon.tsx";
import { StepIcon, TriggerIcon } from "../components/StepIcon.tsx";
import { humanize } from "../format.ts";
import type { StepStatus, WorkflowStep } from "../types.ts";
import type { FlowNode } from "./flow.ts";

// What the buttons above a selected card can do, given by the builder.
export type StepActions = {
  widenSettings: () => void;
  duplicate: (stepId: string) => void;
  remove: (stepId: string) => void;
};

// Empty when the workflow is read-only, so no buttons are shown.
export const StepActionsContext = createContext<StepActions | null>(null);

// The status of each step in the run being shown. Kept apart from the nodes,
// so that watching a run never counts as editing the workflow.
export const StepStatusContext = createContext<Map<string, StepStatus>>(new Map());

const statusClass: Record<StepStatus, string> = {
  running: "running",
  waiting: "waiting",
  succeeded: "x-ok",
  failed: "x-err",
  skipped: "x-skip",
};

function describe(step: WorkflowStep): string {
  switch (step.type) {
    case "connector":
      return humanize(step.config.action);
    case "if":
      return "If / else";
    case "delay":
      return `Wait ${step.config.amount} ${step.config.unit}`;
    case "approval":
      return "Wait for approval";
    case "loop":
      return "For each item";
    default:
      return `${step.config.method} request`;
  }
}

function StatusMark({ status }: { status?: StepStatus }) {
  if (status === "succeeded") return <span className="node-x ok"><Check size={11} aria-hidden="true" /></span>;
  if (status === "failed") return <span className="node-x err"><X size={11} aria-hidden="true" /></span>;
  if (status === "running") return <span className="node-x run"><Loader2 size={11} className="spin" aria-hidden="true" /></span>;
  if (status === "waiting") return <span className="node-x wait"><Clock size={11} aria-hidden="true" /></span>;
  return null;
}

function BranchHandles({ first, second }: { first: { id: string; label: string }; second: { id: string; label: string } }) {
  return (
    <>
      <Handle id={first.id} type="source" position={Position.Right} style={{ top: "30%" }} />
      <Handle id={second.id} type="source" position={Position.Right} style={{ top: "70%" }} />
      <span className="handle-label" style={{ top: "30%" }}>{first.label}</span>
      <span className="handle-label" style={{ top: "70%" }}>{second.label}</span>
    </>
  );
}

export function StepNode({ data, selected }: NodeProps<FlowNode>) {
  const step = data.step as WorkflowStep;
  const status = useContext(StepStatusContext).get(step.id);
  const actions = useContext(StepActionsContext);

  return (
    <div className={`node ${selected ? "is-sel" : ""} ${status ? statusClass[status] : ""}`}>
      {actions && selected && (
        // "nodrag" stops a press on these buttons from moving the card.
        <div className="node-bar nodrag">
          <button className="btn btn-g btn-sm btn-ic" aria-label="Open full step view" title="Open full step view" onClick={actions.widenSettings}>
            <DesignIcon name="fit" />
          </button>
          <button className="btn btn-g btn-sm btn-ic" aria-label="Duplicate step" title="Duplicate" onClick={() => actions.duplicate(step.id)}>
            <DesignIcon name="copy" />
          </button>
          <button className="btn btn-g btn-sm btn-ic is-danger" aria-label="Delete step" title="Delete" onClick={() => actions.remove(step.id)}>
            <DesignIcon name="trash" />
          </button>
        </div>
      )}
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

      {step.type === "if" && <BranchHandles first={{ id: "true", label: "True" }} second={{ id: "false", label: "False" }} />}
      {step.type === "approval" && <BranchHandles first={{ id: "approved", label: "Approved" }} second={{ id: "rejected", label: "Rejected" }} />}
      {step.type !== "if" && step.type !== "approval" && <Handle id="success" type="source" position={Position.Right} />}
      <Handle id="error" className="error-handle" type="source" position={Position.Bottom} title="Connect this to run a step when this one fails" />
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
