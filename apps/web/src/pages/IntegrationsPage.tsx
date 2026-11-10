import { Check, KeyRound, Link2, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { PageHead, Shell } from "../components/Shell.tsx";
import { ServiceLogo } from "../components/StepIcon.tsx";
import type { Connection, ConnectorInfo } from "../types.ts";
import { useLoad } from "../useLoad.ts";

type Message = { text: string; isError: boolean };

const SERVICE_DETAILS: Record<string, { category: string; description: string }> = {
  slack: { category: "Messaging", description: "Post messages to a channel when something happens." },
  google_sheets: { category: "Files", description: "Add rows to a sheet, or read the rows already in it." },
  gmail: { category: "Email", description: "Send emails, and find or read messages in a mailbox." },
  stripe: { category: "Payments", description: "Create customers and payments, and list recent customers." },
};

export function IntegrationsPage() {
  const [params] = useSearchParams();
  const initial: Message | null = params.get("error")
    ? { text: params.get("error") as string, isError: true }
    : params.get("connected")
      ? { text: "Connected", isError: false }
      : null;
  const [message, setMessage] = useState<Message | null>(initial);
  const [openConnectorId, setOpenConnectorId] = useState<string | null>(null);

  const connectors = useLoad(api.listConnectors);
  const connections = useLoad(api.listConnections);

  const connectionsFor = (connectorId: string) => connections.data?.filter((item) => item.connector === connectorId) ?? [];
  const openConnector = connectors.data?.find((connector) => connector.id === openConnectorId);

  // While the dialog is open it covers the page, so messages appear inside it.
  const notice = <div role="status">{message && <div className={`notice ${message.isError ? "err" : "ok"}`}>{message.text}</div>}</div>;

  function openDialog(connectorId: string) {
    setMessage(null);
    setOpenConnectorId(connectorId);
  }

  return (
    <Shell>
      <div className="page">
        <PageHead title="Integrations" subtitle="Connect the services your workflows use. Credentials are encrypted before they are stored." />

        {!openConnector && notice}
        {connectors.error && <div className="notice err">{connectors.error}</div>}
        {connections.error && <div className="notice err">{connections.error}</div>}

        <div className="g-auto">
          {/* Waits for both lists, so a connected service never shows Connect for a moment. */}
          {connections.data && connectors.data?.map((connector) => (
            <ConnectorCard
              key={connector.id}
              connector={connector}
              connections={connectionsFor(connector.id)}
              onOpen={() => openDialog(connector.id)}
            />
          ))}
        </div>

        {openConnector && (
          <ConnectorDialog
            connector={openConnector}
            connections={connectionsFor(openConnector.id)}
            notice={notice}
            onMessage={setMessage}
            onChanged={connections.reload}
            onClose={() => setOpenConnectorId(null)}
          />
        )}
      </div>
    </Shell>
  );
}

function ConnectionBadge({ connections }: { connections: Connection[] }) {
  if (connections.length === 0) {
    return <span className="badge b-off"><Link2 size={12} aria-hidden="true" /> Not connected</span>;
  }
  if (connections.some((connection) => connection.status === "needs_reconnect")) {
    return <span className="badge b-warn"><TriangleAlert size={12} aria-hidden="true" /> Needs reconnecting</span>;
  }
  return <span className="badge b-ok"><Check size={12} aria-hidden="true" /> Connected</span>;
}

function ConnectorCard({ connector, connections, onOpen }: { connector: ConnectorInfo; connections: Connection[]; onOpen: () => void }) {
  const { can } = useAuth();
  const canManage = can("integrations.manage");
  const details = SERVICE_DETAILS[connector.id];
  const isOAuth = connector.authType === "oauth";

  return (
    <article className="card int-card">
      <div className="row int-top">
        <ServiceLogo connector={connector.id} large />
        <div className="grow">
          <h2 className="strong int-name">{connector.name}</h2>
          <div className="small muted">{details?.category}</div>
        </div>
        <ConnectionBadge connections={connections} />
      </div>
      <p className="small muted int-desc">{details?.description}</p>
      <div className="row between int-foot">
        <span className="small dim row int-auth">
          {isOAuth ? <ShieldCheck size={13} aria-hidden="true" /> : <KeyRound size={13} aria-hidden="true" />}
          {isOAuth ? "OAuth" : connector.tokenLabel}
        </span>
        {canManage ? (
          <button className={`btn btn-sm ${connections.length === 0 ? "btn-p" : ""}`} onClick={onOpen}>
            {connections.length === 0 ? "Connect" : "Manage"}
          </button>
        ) : connections.length > 0 && <button className="btn btn-sm" onClick={onOpen}>View</button>}
      </div>
    </article>
  );
}

function ConnectorDialog({ connector, connections, notice, onMessage, onChanged, onClose }: { connector: ConnectorInfo; connections: Connection[]; notice: ReactNode; onMessage: (message: Message) => void; onChanged: () => Promise<void>; onClose: () => void }) {
  const { can } = useAuth();
  const canManage = can("integrations.manage");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="scrim">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="connector-dialog-title">
        <div className="row" style={{ gap: 10 }}>
          <ServiceLogo connector={connector.id} large />
          <h2 id="connector-dialog-title">{!canManage ? "" : connections.length === 0 ? "Connect " : "Manage "}{connector.name}</h2>
        </div>

        {notice}
        {canManage && connector.tokenHelp && <p className="hint">{connector.tokenHelp}</p>}

        {canManage && (connector.authType === "token" ? (
          <TokenForm connector={connector} onMessage={onMessage} onChanged={onChanged} />
        ) : connector.configured ? (
          <a className="btn btn-p" href={`/api/connections/oauth/${connector.id}/start`}>Connect with Google</a>
        ) : (
          <p className="hint">Add the Google client ID and secret to the server settings first.</p>
        ))}

        {connections.map((connection) => (
          <ConnectionRow key={connection.id} connection={connection} canManage={canManage} onMessage={onMessage} onChanged={onChanged} />
        ))}

        <div className="modal-a">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function TokenForm({ connector, onMessage, onChanged }: { connector: ConnectorInfo; onMessage: (message: Message) => void; onChanged: () => Promise<void> }) {
  const [token, setToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const result = await api.createTokenConnection(connector.id, token);
      setToken("");
      onMessage({ text: `Connected: ${result.account}`, isError: false });
      await onChanged();
    } catch (problem) {
      onMessage({ text: (problem as Error).message, isError: true });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="row" onSubmit={submit}>
      <input className="input" type="password" autoComplete="off" required aria-label={connector.tokenLabel} placeholder={connector.tokenLabel} value={token} onChange={(event) => setToken(event.target.value)} />
      <button className="btn btn-p" disabled={isSaving || !token}>Connect</button>
    </form>
  );
}

function ConnectionRow({ connection, canManage, onMessage, onChanged }: { connection: Connection; canManage: boolean; onMessage: (message: Message) => void; onChanged: () => Promise<void> }) {
  const isExpired = connection.status === "needs_reconnect";

  async function test() {
    const result = await api.testConnection(connection.id);
    onMessage(result.ok ? { text: `Working: ${result.account}`, isError: false } : { text: result.error as string, isError: true });
    await onChanged();
  }

  async function remove() {
    await api.deleteConnection(connection.id);
    onMessage({ text: "Connection removed", isError: false });
    await onChanged();
  }

  return (
    <div className="conn-row">
      <div className="grow">
        <div className="strong trunc">{connection.account ?? connection.name}</div>
        {isExpired && <div className="err-msg">Expired. Please connect again.</div>}
      </div>
      <button className="btn btn-sm" onClick={test}>Test</button>
      {canManage && <button className="btn btn-sm btn-g" onClick={remove}>Remove</button>}
    </div>
  );
}
