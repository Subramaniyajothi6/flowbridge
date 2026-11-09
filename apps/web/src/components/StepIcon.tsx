import { GitFork, Globe, Hourglass, MousePointerClick, Repeat, UserCheck } from "lucide-react";
import logos from "../assets/logos.json";
import type { WorkflowStep } from "../types.ts";

const logoMap = logos as Record<string, { uri: string; bg: string }>;

export function ServiceLogo({ connector, large }: { connector: string; large?: boolean }) {
  const logo = logoMap[connector];
  return (
    <span className={`step-icon ${large ? "lg" : ""}`} style={{ background: logo?.bg ?? "var(--sunken)" }}>
      {logo && <img src={logo.uri} alt="" />}
    </span>
  );
}

export function TriggerIcon() {
  return (
    <span className="step-icon n-ic trigger">
      <MousePointerClick size={15} aria-hidden="true" />
    </span>
  );
}

export function HttpIcon() {
  return (
    <span className="step-icon n-ic action">
      <Globe size={15} aria-hidden="true" />
    </span>
  );
}

export function IfIcon() {
  return (
    <span className="step-icon n-ic logic">
      <GitFork size={15} aria-hidden="true" />
    </span>
  );
}

export function DelayIcon() {
  return (
    <span className="step-icon n-ic logic">
      <Hourglass size={15} aria-hidden="true" />
    </span>
  );
}

export function ApprovalIcon() {
  return (
    <span className="step-icon n-ic logic">
      <UserCheck size={15} aria-hidden="true" />
    </span>
  );
}

export function LoopIcon() {
  return (
    <span className="step-icon n-ic logic">
      <Repeat size={15} aria-hidden="true" />
    </span>
  );
}

export function StepIcon({ step }: { step: WorkflowStep }) {
  switch (step.type) {
    case "connector":
      return <ServiceLogo connector={step.config.connector} />;
    case "if":
      return <IfIcon />;
    case "delay":
      return <DelayIcon />;
    case "approval":
      return <ApprovalIcon />;
    case "loop":
      return <LoopIcon />;
    default:
      return <HttpIcon />;
  }
}
