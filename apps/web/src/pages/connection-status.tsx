import { Check, Clock, Link2, TriangleAlert } from "lucide-react";
import { formatDate } from "../format.ts";
import type { Connection } from "../types.ts";

// A connection counts as expiring soon in its last two days.
const EXPIRING_SOON_MS = 2 * 86400 * 1000;

export type ConnectionState = "connected" | "expiring" | "reconnect";

export function connectionState(connection: Connection): ConnectionState {
  if (connection.status === "needs_reconnect") return "reconnect";
  if (connection.expiresAt && new Date(connection.expiresAt).getTime() - Date.now() < EXPIRING_SOON_MS) return "expiring";
  return "connected";
}

// The worst state among an app's connections decides its card's badge.
export function worstState(connections: Connection[]): ConnectionState | "none" {
  const states = connections.map(connectionState);
  if (states.length === 0) return "none";
  if (states.includes("reconnect")) return "reconnect";
  return states.includes("expiring") ? "expiring" : "connected";
}

export function StateBadge({ state }: { state: ConnectionState | "none" }) {
  if (state === "none") return <span className="badge b-off"><Link2 size={12} aria-hidden="true" /> Not connected</span>;
  if (state === "reconnect") return <span className="badge b-warn"><TriangleAlert size={12} aria-hidden="true" /> Needs reconnecting</span>;
  if (state === "expiring") return <span className="badge b-warn"><Clock size={12} aria-hidden="true" /> Expiring soon</span>;
  return <span className="badge b-ok"><Check size={12} aria-hidden="true" /> Connected</span>;
}

export function expiryText(connection: Connection): string | null {
  if (connection.status === "needs_reconnect") return "Expired. Connect it again.";
  return connection.expiresAt ? `Stops working ${formatDate(connection.expiresAt)}` : null;
}
