import { KeyRound, Plus, Search, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { PageHead, Shell } from "../components/Shell.tsx";
import { ServiceLogo } from "../components/StepIcon.tsx";
import type { Connection, ConnectorInfo } from "../types.ts";
import { useLoad } from "../useLoad.ts";
import { AddAppDialog } from "./AddAppDialog.tsx";
import { ConnectedAccounts, DisconnectButton } from "./ConnectedAccounts.tsx";
import { connectionState, expiryText, StateBadge, worstState } from "./connection-status.tsx";
import { LogoPicker } from "../components/LogoPicker.tsx";
import { useLogos } from "../logos.tsx";
import { LOGO_HINT, readLogoFile } from "./logo-file.ts";

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
  const [isAddingApp, setIsAddingApp] = useState(false);
  const { can } = useAuth();

  const connectors = useLoad(api.listConnectors);
  const connections = useLoad(api.listConnections);

  // Anyone who can only check existing accounts starts on that tab.
  const [tab, setTab] = useState<"directory" | "accounts">(can("integrations.manage") ? "directory" : "accounts");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const connectionsFor = (connectorId: string) => connections.data?.filter((item) => item.connector === connectorId) ?? [];
  const openConnector = connectors.data?.find((connector) => connector.id === openConnectorId);

  // Only categories that have an app in them are offered.
  const categories = ["All", ...new Set((connectors.data ?? []).map(categoryOf))];
  const visibleConnectors = (connectors.data ?? []).filter((connector) => {
    const words = `${connector.name} ${categoryOf(connector)} ${descriptionOf(connector)}`.toLowerCase();
    return (category === "All" || categoryOf(connector) === category) && words.includes(search.trim().toLowerCase());
  });

  // While the dialog is open it covers the page, so messages appear inside it.
  const notice = <div role="status">{message && <div className={`notice ${message.isError ? "err" : "ok"}`}>{message.text}</div>}</div>;

  function openDialog(connectorId: string) {
    setMessage(null);
    setOpenConnectorId(connectorId);
  }

  return (
    <Shell>
      <div className="page">
        <PageHead title="Integrations" subtitle="Connect the services your workflows use. Credentials are encrypted before they are stored.">
          {can("apps.manage") && <button className="btn btn-p" onClick={() => setIsAddingApp(true)}><Plus size={15} aria-hidden="true" /> Add app</button>}
        </PageHead>

        {!openConnector && notice}
        {connectors.error && <div className="notice err">{connectors.error}</div>}
        {connections.error && <div className="notice err">{connections.error}</div>}

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "directory"} className={`tab ${tab === "directory" ? "is-on" : ""}`} onClick={() => setTab("directory")}>Directory</button>
          <button role="tab" aria-selected={tab === "accounts"} className={`tab ${tab === "accounts" ? "is-on" : ""}`} onClick={() => setTab("accounts")}>
            Connected accounts{connections.data ? ` (${connections.data.length})` : ""}
          </button>
        </div>

        {tab === "directory" && (
          <>
            <div className="row wrap">
              <div className="list-search">
                <span className="search-ic"><Search size={14} aria-hidden="true" /></span>
                <input className="input" type="search" aria-label="Search integrations" placeholder="Search integrations" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <div className="row wrap" role="group" aria-label="Filter by category">
                {categories.map((item) => (
                  <button key={item} className={`chip ${category === item ? "is-on" : ""}`} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>
                ))}
              </div>
            </div>

            <div className="g-auto">
              {/* Waits for both lists, so a connected service never shows Connect for a moment. */}
              {connections.data && visibleConnectors.map((connector) => (
                <ConnectorCard
                  key={connector.id}
                  connector={connector}
                  connections={connectionsFor(connector.id)}
                  onOpen={() => openDialog(connector.id)}
                />
              ))}
            </div>
            {connections.data && visibleConnectors.length === 0 && <p className="muted">No apps match. Try a different search or category.</p>}
          </>
        )}

        {tab === "accounts" && connections.data && connectors.data && (
          <ConnectedAccounts
            connections={connections.data}
            connectors={connectors.data}
            onMessage={setMessage}
            onChanged={connections.reload}
          />
        )}

        {openConnector && (
          <ConnectorDialog
            connector={openConnector}
            connections={connectionsFor(openConnector.id)}
            notice={notice}
            onMessage={setMessage}
            onChanged={connections.reload}
            onClose={() => setOpenConnectorId(null)}
            onAppRemoved={async () => {
              setOpenConnectorId(null);
              await connectors.reload();
            }}
          />
        )}

        {isAddingApp && (
          <AddAppDialog
            onClose={() => setIsAddingApp(false)}
            onAdded={async (name) => {
              setIsAddingApp(false);
              setMessage({ text: `${name} was added. Connect it with its key to start using it.`, isError: false });
              await connectors.reload();
            }}
          />
        )}
      </div>
    </Shell>
  );
}

function categoryOf(connector: ConnectorInfo): string {
  return SERVICE_DETAILS[connector.id]?.category ?? "Custom app";
}

function descriptionOf(connector: ConnectorInfo): string {
  return SERVICE_DETAILS[connector.id]?.description ?? `Calls ${connector.customHost}. ${connector.actions.length} ${connector.actions.length === 1 ? "action" : "actions"}.`;
}

function ConnectorCard({ connector, connections, onOpen }: { connector: ConnectorInfo; connections: Connection[]; onOpen: () => void }) {
  const { can } = useAuth();
  const canManage = can("integrations.manage");
  const isOAuth = connector.authType === "oauth";

  return (
    <article className="card int-card">
      <div className="row int-top">
        <ServiceLogo connector={connector.id} large />
        <div className="grow">
          <h2 className="strong int-name">{connector.name}</h2>
          <div className="small muted">{categoryOf(connector)}</div>
        </div>
        <StateBadge state={worstState(connections)} />
      </div>
      <p className="small muted int-desc">{descriptionOf(connector)}</p>
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

function ConnectorDialog({ connector, connections, notice, onMessage, onChanged, onClose, onAppRemoved }: { connector: ConnectorInfo; connections: Connection[]; notice: ReactNode; onMessage: (message: Message) => void; onChanged: () => Promise<void>; onClose: () => void; onAppRemoved: () => Promise<void> }) {
  const { can } = useAuth();
  const canManage = can("integrations.manage");
  const canChangeLogo = can("apps.manage");
  const canRemoveApp = connector.customHost !== undefined && canChangeLogo;
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logos = useLogos();
  // Only a built-in app has a default logo to go back to.
  const canUseDefaultLogo = connector.customHost === undefined && logos.addresses[connector.id] !== undefined;

  async function changeLogo(file: File | undefined) {
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      await api.setLogo(connector.id, await readLogoFile(file));
      await logos.refresh();
      onMessage({ text: "Logo changed", isError: false });
    } catch (error) {
      onMessage({ text: (error as Error).message, isError: true });
    } finally {
      setIsUploadingLogo(false);
    }
  }

  async function useDefaultLogo() {
    try {
      await api.resetLogo(connector.id);
      await logos.refresh();
      onMessage({ text: "Default logo restored", isError: false });
    } catch (error) {
      onMessage({ text: (error as Error).message, isError: true });
    }
  }

  async function removeApp() {
    if (!isConfirmingRemove) {
      setIsConfirmingRemove(true);
      return;
    }
    try {
      await api.deleteCustomApp(connector.id);
      onMessage({ text: `${connector.name} was removed`, isError: false });
      await onAppRemoved();
    } catch (error) {
      setIsConfirmingRemove(false);
      onMessage({ text: (error as Error).message, isError: true });
    }
  }

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

        {canChangeLogo && (
          <div className="logo-row">
            <LogoPicker
              preview={<ServiceLogo connector={connector.id} large />}
              buttonLabel="Change logo"
              hint={LOGO_HINT}
              isBusy={isUploadingLogo}
              onFile={changeLogo}
              extra={canUseDefaultLogo && <button className="btn btn-g btn-sm" onClick={useDefaultLogo}>Use default logo</button>}
            />
          </div>
        )}

        <div className="modal-a">
          {canRemoveApp && <button className="btn btn-g app-remove" onClick={removeApp}>{isConfirmingRemove ? "Click again to remove" : "Remove app"}</button>}
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
  const state = connectionState(connection);

  async function test() {
    const result = await api.testConnection(connection.id);
    onMessage(result.ok ? { text: `Working: ${result.account}`, isError: false } : { text: result.error as string, isError: true });
    await onChanged();
  }

  return (
    <div className="conn-row">
      <div className="grow">
        <div className="strong trunc">{connection.account ?? connection.name}</div>
        {expiryText(connection) && <div className={state === "connected" ? "small dim" : "err-msg"}>{expiryText(connection)}</div>}
      </div>
      <button className="btn btn-sm" onClick={test}>Test</button>
      {canManage && <DisconnectButton connection={connection} onMessage={onMessage} onChanged={onChanged} />}
    </div>
  );
}
