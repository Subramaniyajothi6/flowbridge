import { Users } from "lucide-react";
import { ROLE_LABELS, useAuth } from "../auth.tsx";
import type { Role } from "../types.ts";

// Shared by every version of Overview.

// One sentence telling each person what their role lets them do.
const ROLE_NOTES: Record<Role, string> = {
  administrator: "You have full access, including members, integrations and workspace settings.",
  workflow_builder: "You can build, test and publish workflows, connect integrations and investigate failures. You can't manage members.",
  business_user: "You can run published workflows, follow their progress, retry failed runs and make approval decisions. You can't edit workflows or see step data.",
};

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  return hour < 18 ? "Good afternoon" : "Good evening";
}

export function RoleBanner() {
  const { session } = useAuth();
  if (!session) return null;
  return (
    <div className="notice info">
      <Users size={16} aria-hidden="true" />
      <span className="grow"><b>{ROLE_LABELS[session.user.role]}.</b> {ROLE_NOTES[session.user.role]}</span>
    </div>
  );
}
