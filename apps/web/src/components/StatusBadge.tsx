import type { RunStatus, StepStatus } from "../types.ts";

const styles: Record<RunStatus | StepStatus, { className: string; dot: string; label: string }> = {
  queued: { className: "b-off", dot: "", label: "Queued" },
  running: { className: "b-run", dot: "", label: "Running" },
  waiting: { className: "b-warn", dot: "", label: "Waiting" },
  succeeded: { className: "b-ok", dot: "ok", label: "Succeeded" },
  failed: { className: "b-err", dot: "err", label: "Failed" },
  skipped: { className: "b-off", dot: "", label: "Skipped" },
};

export function StatusBadge({ status }: { status: RunStatus | StepStatus }) {
  const { className, dot, label } = styles[status];
  return (
    <span className={`badge ${className}`}>
      <span className={`dot ${dot}`} />
      {label}
    </span>
  );
}
