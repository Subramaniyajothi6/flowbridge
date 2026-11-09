import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.ts";
import { PageHead, Shell } from "../components/Shell.tsx";
import { ServiceLogo } from "../components/StepIcon.tsx";
import type { Connection, ConnectorInfo } from "../types.ts";
import { useLoad } from "../useLoad.ts";

type Message = { text: string; isError: boolean };

export function IntegrationsPage() {
  const [params] = useSearchParams();
  const initial: Message | null = params.get("error")
    ? { text: params.get("error") as string, isError: true }
    : params.get("connected")
      ? { text: "Connected", isError: false }
      : null;
  const [message, setMessage] = useState<Message | null>(initial);

  const connectors = useLoad(api.listConnectors);
  const connections = useLoad(api.listConnections);

  return (
    <Shell>
      <div className="page">
        <PageHead title="Integrations" subtitle="Connect the services your workflows use. Credentials are encrypted before they are stored." />

        <div role="status">{message && <div className={`notice ${message.isError ? "err" : "ok"}`}>{message.text}</div>}</div>
        {connectors.error && <div className="notice err">{connectors.error}</div>}

        <div className="g-auto">
          {connectors.data?.map((connector) => (
            <ConnectorCard
              key={connector.id}
              connector={connector}
              connections={connections.data?.filter((item) => item.connector === connector.id) ?? []}
              onMessage={setMessage}
              onChanged={connections.reload}
            />
          ))}
        </div>
      </div>
    </Shell>
  );
}

function ConnectorCard({ connector, connections, onMessage, onChanged }: { connector: ConnectorInfo; connections: Connection[]; onMessage: (message: Message) => void; onChanged: () => Promise<void> }) {
  return (
    <section className="card card-b">
      <div className="row">
        <ServiceLogo connector={connector.id} large />
        <div className="grow">
          <h2 className="card-t">{connector.name}</h2>
          <p className="small muted">{connector.actions.length} actions</p>
        </div>
      </div>
      {connector.tokenHelp && <p className="hint" style={{ marginTop: 10 }}>{connector.tokenHelp}</p>}

      {connector.authType === "token" ? (
        <TokenForm connector={connector} onMessage={onMessage} onChanged={onChanged} />
      ) : connector.configured ? (
        <a className="btn btn-p" style={{ marginTop: 12 }} href={`/api/connections/oauth/${connector.id}/start`}>Connect with Google</a>
      ) : (
        <p className="hint" style={{ marginTop: 10 }}>Add the Google client ID and secret to the server settings first.</p>
      )}

      {connections.map((connection) => (
        <ConnectionRow key={connection.id} connection={connection} onMessage={onMessage} onChanged={onChanged} />
      ))}
    </section>
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
    <form className="row" style={{ marginTop: 12 }} onSubmit={submit}>
      <input className="input" type="password" autoComplete="off" required aria-label={connector.tokenLabel} placeholder={connector.tokenLabel} value={token} onChange={(event) => setToken(event.target.value)} />
      <button className="btn btn-p" disabled={isSaving || !token}>Connect</button>
    </form>
  );
}

function ConnectionRow({ connection, onMessage, onChanged }: { connection: Connection; onMessage: (message: Message) => void; onChanged: () => Promise<void> }) {
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
      <button className="btn btn-sm btn-g" onClick={remove}>Remove</button>
    </div>
  );
}
