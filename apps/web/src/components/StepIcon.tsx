import { GitFork, Globe, Hourglass, MousePointerClick, Puzzle, Repeat, UserCheck } from "lucide-react";
import { useState } from "react";
import logos from "../assets/logos.json";
import { useLogos } from "../logos.tsx";
import type { WorkflowStep } from "../types.ts";

const logoMap = logos as Record<string, { uri: string; bg: string }>;

export function ServiceLogo({ connector, large }: { connector: string; large?: boolean }) {
  // A logo an Administrator chose wins. Otherwise a built-in app uses the one that ships with FlowBridge.
  const chosen = useLogos().addresses[connector];
  const address = chosen ?? logoMap[connector]?.uri ?? null;
  // Falls back to a puzzle piece when an app has no logo, or its picture fails to load.
  const [failedAddress, setFailedAddress] = useState<string | null>(null);

  return (
    <span className={`step-icon ${large ? "lg" : ""}`} style={{ background: chosen ? "var(--sunken)" : logoMap[connector]?.bg ?? "var(--sunken)" }}>
      {address && failedAddress !== address ? <img src={address} alt="" onError={() => setFailedAddress(address)} /> : <Puzzle size={large ? 18 : 15} aria-hidden="true" />}
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
