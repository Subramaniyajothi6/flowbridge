import { Plug } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { ServiceLogo } from "../components/StepIcon.tsx";
import { formatDate } from "../format.ts";
import type { Connection, ConnectorInfo } from "../types.ts";
import { connectionState, expiryText, StateBadge } from "./connection-status.tsx";

type Message = { text: string; isError: boolean };

// Long lists would make the table too tall, so the rest are counted.
const SHOWN_WORKFLOWS = 2;

// Every saved connection in one table, with where it is used, so a person can see
// what would break before they disconnect anything.
export function ConnectedAccounts({ connections, connectors, onMessage, onChanged }: {
  connections: Connection[];
  connectors: ConnectorInfo[];
  onMessage: (message: Message) => void;
  onChanged: () => Promise<void>;
}) {
  const { can } = useAuth();
  const canManage = can("integrations.manage");
  const canOpenBuilder = can("builder.view");

  if (connections.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <span className="empty-ic"><Plug size={20} aria-hidden="true" /></span>
          <strong>No connected accounts yet</strong>
          <p className="muted">Connect an app from the Directory tab.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="tbl-wrap tbl-round">
        <table className="tbl">
          <thead>
            <tr><th>Account</th><th>Status</th><th className="hide-m">Used by</th><th className="hide-m">Last checked</th><th className="hide-m">Added by</th><th><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {connections.map((connection) => {
              const appName = connectors.find((connector) => connector.id === connection.connector)?.name ?? connection.connector;
              return (
                <tr key={connection.id}>
                  <td>
                    <div className="row">
                      <ServiceLogo connector={connection.connector} />
                      <div className="grow">
                        <div className="strong trunc">{appName}</div>
                        <div className="small muted trunc">{connection.account ?? connection.name}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <StateBadge state={connectionState(connection)} />
                    {expiryText(connection) && <div className="small dim">{expiryText(connection)}</div>}
                  </td>
                  <td className="hide-m">
                    {connection.usedBy.length === 0 && <span className="dim">Not used</span>}
                    {connection.usedBy.slice(0, SHOWN_WORKFLOWS).map((workflow) => (
                      <div key={workflow.id} className="small trunc used-by">
                        {canOpenBuilder ? <Link to={`/workflows/${workflow.id}`}>{workflow.name}</Link> : workflow.name}
                      </div>
                    ))}
                    {connection.usedBy.length > SHOWN_WORKFLOWS && <div className="small dim">and {connection.usedBy.length - SHOWN_WORKFLOWS} more</div>}
                  </td>
                  <td className="muted hide-m">{connection.lastCheckedAt ? formatDate(connection.lastCheckedAt) : "Never"}</td>
                  <td className="muted hide-m">{connection.createdBy ?? "-"}</td>
                  <td className="r">
                    <AccountActions connection={connection} canManage={canManage} onMessage={onMessage} onChanged={onChanged} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountActions({ connection, canManage, onMessage, onChanged }: { connection: Connection; canManage: boolean; onMessage: (message: Message) => void; onChanged: () => Promise<void> }) {
  const [isTesting, setIsTesting] = useState(false);

  async function test() {
    setIsTesting(true);
    const result = await api.testConnection(connection.id);
    onMessage(result.ok ? { text: `Working: ${result.account}`, isError: false } : { text: result.error as string, isError: true });
    setIsTesting(false);
    await onChanged();
  }

  return (
    <div className="row team-actions">
      <button className="btn btn-sm" disabled={isTesting} onClick={test}>{isTesting ? "Testing..." : "Test"}</button>
      {canManage && <DisconnectButton connection={connection} onMessage={onMessage} onChanged={onChanged} />}
    </div>
  );
}

// Asks once before disconnecting, and says which workflows will stop working.
export function DisconnectButton({ connection, onMessage, onChanged }: { connection: Connection; onMessage: (message: Message) => void; onChanged: () => Promise<void> }) {
  const [isConfirming, setIsConfirming] = useState(false);

  async function disconnect() {
    if (!isConfirming) {
      setIsConfirming(true);
      const count = connection.usedBy.length;
      if (count > 0) onMessage({ text: `${count} ${count === 1 ? "workflow uses" : "workflows use"} this account and will fail until it is connected again. Click Confirm to disconnect.`, isError: true });
      return;
    }
    await api.deleteConnection(connection.id);
    onMessage({ text: "Disconnected", isError: false });
    await onChanged();
  }

  return (
    <>
      <button className={`btn btn-sm ${isConfirming ? "btn-d" : "btn-g"}`} onClick={disconnect}>{isConfirming ? "Confirm" : "Disconnect"}</button>
      {isConfirming && <button className="btn btn-sm btn-g" onClick={() => setIsConfirming(false)}>Cancel</button>}
    </>
  );
}
