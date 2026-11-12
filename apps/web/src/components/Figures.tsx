import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// The figure cards on Overview: a label with an icon, the number, a line under it, and an optional small picture.
export function Figure({ label, icon: Icon, value, children, picture }: { label: string; icon: LucideIcon; value: string; children: ReactNode; picture?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-head">
        <span className="stat-l">{label}</span>
        <span className="stat-ic"><Icon size={16} aria-hidden="true" /></span>
      </div>
      <span className="stat-v">{value}</span>
      <span className="stat-d">{children}</span>
      {picture}
    </div>
  );
}

// Green when all is well, amber when something needs looking at, red when something failed.
export function StatusDot({ tone }: { tone: "ok" | "warn" | "err" }) {
  return <span className={`stat-dot is-${tone}`} aria-hidden="true" />;
}

// A thin bar. Each part is a share of the whole, from 0 to 100.
export function Meter({ parts, label }: { parts: { share: number; tone?: "ok" | "bad" }[]; label: string }) {
  return (
    <div className="stat-meter" role="img" aria-label={label}>
      {parts.map((part, index) => <i key={index} className={part.tone ?? ""} style={{ width: `${Math.min(100, part.share)}%` }} />)}
    </div>
  );
}
