import { GitFork, Globe, MousePointerClick } from "lucide-react";
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

export function StepIcon({ step }: { step: WorkflowStep }) {
  if (step.type === "connector") return <ServiceLogo connector={step.config.connector} />;
  return step.type === "if" ? <IfIcon /> : <HttpIcon />;
}
