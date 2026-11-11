import { addEdge, useEdgesState, useNodesState, type Connection as FlowConnection, type Edge, type EdgeChange, type NodeChange } from "@xyflow/react";
import { ArrowRightLeft, ChevronLeft, Copy, FlaskConical, LayoutGrid, Rocket, Rows3, Save, Search, Settings2, Trash2, Unlink } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { ApprovalIcon, DelayIcon, HttpIcon, IfIcon, LoopIcon, ServiceLogo } from "../components/StepIcon.tsx";
import { formatDuration, humanize } from "../format.ts";
import type { ConnectorInfo, Definition, PublicationStatus, RunDetail, Samples, Trigger, WorkflowDetail, WorkflowStep } from "../types.ts";
import { useLoad } from "../useLoad.ts";
import type { DataGroup } from "./fields.tsx";
import { connectionToEdge, definitionToFlow, findProblems, flowToDefinition, listSampleValues, statusMap, stepsBefore, TRIGGER_ID, uniqueStepId, wouldCreateLoop, type FlowNode } from "./flow.ts";
import { CanvasMenu, type MenuItem } from "./CanvasMenu.tsx";
import { StepPanel } from "./StepPanel.tsx";
import { TriggerPanel } from "./TriggerPanel.tsx";
import { STEP_DRAG_TYPE, WorkflowCanvas } from "./WorkflowCanvas.tsx";

const COLUMN_GAP = 300;

function summarize(triggers: Trigger[]): string {
  const active = triggers.filter((trigger) => trigger.enabled).length;
  return active === 0 ? "Manual or webhook" : `Manual, webhook + ${active} more`;
}

// One entry in the left panel. It can be clicked, or dragged onto the canvas.
type PaletteEntry = {
  key: string;
  label: string;
  description: string;
  icon: ReactNode;
  baseId: string;
  stepName: string;
  make: (id: string, name: string) => WorkflowStep;
};

type OpenMenu = { kind: "node" | "edge"; id: string; at: { x: number; y: number } };

// What a connection can be switched to, depending on the kind of step it leaves.
const BRANCH_LABELS: Record<string, string> = {
  success: "Run when it succeeds",
  error: "Run only when it fails",
  true: "Run when True",
  false: "Run when False",
  approved: "Run when approved",
  rejected: "Run when rejected",
};

function handlesFor(step: WorkflowStep | undefined): string[] {
  if (!step) return [];
  if (step.type === "if") return ["true", "false", "error"];
  if (step.type === "approval") return ["approved", "rejected", "error"];
  return ["success", "error"];
}

function PaletteItem({ entry, onAdd }: { entry: PaletteEntry; onAdd: () => void }) {
  return (
    <button
      className="pal-i"
      title={`${entry.description}. Click to add, or drag onto the canvas.`}
      onClick={onAdd}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(STEP_DRAG_TYPE, entry.key);
        event.dataTransfer.effectAllowed = "copy";
      }}
    >
      {entry.icon}
      <span className="grow">
        <span className="strong trunc pal-label">{entry.label}</span>
        <span className="small muted trunc pal-desc">{entry.description}</span>
      </span>
    </button>
  );
}

export function BuilderPage() {
  const { id = "" } = useParams();
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api.getWorkflow(id).then(setWorkflow).catch((problem: Error) => setLoadError(problem.message));
  }, [id]);

  if (loadError) return <div className="page"><div className="notice err">{loadError}</div></div>;
  if (!workflow) return <div className="page"><span className="skel" /></div>;
  return <Builder key={workflow.id} initial={workflow} />;
}

function Builder({ initial }: { initial: WorkflowDetail }) {
  const workflowId = initial.id;
  const { can } = useAuth();
  const canEdit = can("workflows.edit");

  // Opens saved edits if there are any, and otherwise what is published.
  const flow = useMemo(() => {
    const emptyDefinition: Definition = { steps: [], edges: [] };
    return definitionToFlow(initial.draftDefinition ?? initial.versions[0]?.definition ?? emptyDefinition, "Manual or webhook");
  }, [initial]);
  const [nodes, setNodes, applyNodeChanges] = useNodesState<FlowNode>(flow.nodes);
  const [edges, setEdges, applyEdgeChanges] = useEdgesState<Edge>(flow.edges);

  const [name, setName] = useState(initial.name);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(initial.versions[0]?.versionNumber ?? null);
  const [publication, setPublication] = useState<PublicationStatus>(initial.status);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"card" | "tile">("card");
  const [testData, setTestData] = useState("{\n  \n}");
  const [samples, setSamples] = useState<Samples>({ trigger: null, steps: {} });
  const [liveRun, setLiveRun] = useState<RunDetail | null>(null);
  const [hasEditedTestData, setHasEditedTestData] = useState(false);
  const [stepSearch, setStepSearch] = useState("");
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);

  const connectors = useLoad(api.listConnectors);
  const connections = useLoad(api.listConnections);
  const triggers = useLoad(() => api.listTriggers(workflowId), [workflowId]);

  const connectorList: ConnectorInfo[] = connectors.data ?? [];
  const pollTimer = useRef<number | null>(null);

  const loadSamples = useCallback(async () => {
    const loaded = await api.getSamples(workflowId);
    setSamples(loaded);
    return loaded;
  }, [workflowId]);

  // Offers the most recent real data as the starting test data.
  useEffect(() => {
    loadSamples().then((loaded) => {
      if (loaded.trigger && Object.keys(loaded.trigger as object).length > 0) setTestData(JSON.stringify(loaded.trigger, null, 2));
    });
  }, [loadSamples]);

  useEffect(() => {
    const summary = summarize(triggers.data ?? []);
    setNodes((current) => current.map((node) => (node.id === TRIGGER_ID ? { ...node, data: { summary } } : node)));
  }, [triggers.data, setNodes]);

  useEffect(() => () => {
    if (pollTimer.current) window.clearInterval(pollTimer.current);
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  // Moving or removing something counts as an edit. Selecting something does not.
  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    applyNodeChanges(changes);
    if (changes.some((change) => change.type === "remove" || (change.type === "position" && change.dragging))) setIsDirty(true);
  }, [applyNodeChanges]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    applyEdgeChanges(changes);
    if (changes.some((change) => change.type === "remove")) setIsDirty(true);
  }, [applyEdgeChanges]);

  const isValidConnection = useCallback((connection: FlowConnection | Edge) => {
    const { source, target } = connection;
    if (!source || !target || target === TRIGGER_ID) return false;
    if (wouldCreateLoop(source, target, edges)) return false;
    // A step that follows other steps cannot also be a starting step.
    return source !== TRIGGER_ID || !edges.some((edge) => edge.target === target);
  }, [edges]);

  const onConnect = useCallback((connection: FlowConnection) => {
    const edge = connectionToEdge(connection.source, connection.sourceHandle as string, connection.target);
    // Once a step follows another step, it no longer starts from the trigger.
    setEdges((current) => addEdge(edge, current.filter((item) => item.source !== TRIGGER_ID || item.target !== connection.target)));
    setIsDirty(true);
  }, [setEdges]);

  function updateStep(step: WorkflowStep) {
    setNodes((current) => current.map((node) => (node.id === step.id ? { ...node, data: { step } } : node)));
    setIsDirty(true);
  }

  function deleteStep(stepId: string) {
    setNodes((current) => current.filter((node) => node.id !== stepId));
    setEdges((current) => current.filter((edge) => edge.source !== stepId && edge.target !== stepId));
    setSelectedId(null);
    setIsDirty(true);
  }

  // Clicked: added after the selected step, or at the end of the workflow, and connected to it.
  // Dropped: placed where it was let go, unconnected, so the person draws its connections.
  function addStep(entry: PaletteEntry, droppedAt?: { x: number; y: number }) {
    const stepId = uniqueStepId(entry.baseId, nodes);
    const source = droppedAt ? null : nodes.find((node) => node.id === selectedId) ?? nodes.filter((node) => !edges.some((edge) => edge.source === node.id)).at(-1) ?? nodes[0];

    const newNode: FlowNode = {
      id: stepId,
      type: "step",
      selected: true,
      position: droppedAt ?? { x: (source as FlowNode).position.x + COLUMN_GAP, y: (source as FlowNode).position.y + edges.filter((edge) => edge.source === source?.id).length * 130 },
      data: { step: entry.make(stepId, entry.stepName) },
    };

    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), newNode]);
    if (source) setEdges((current) => [...current, connectionToEdge(source.id, chooseHandle(source, current), stepId)]);
    setSelectedId(stepId);
    setIsDirty(true);
  }

  // A copy sits just below and to the right of the original, with no connections yet.
  function duplicateStep(stepId: string) {
    const original = nodes.find((node) => node.id === stepId);
    const step = original?.data.step;
    if (!original || !step) return;

    const copyId = uniqueStepId(step.id, nodes);
    const copy: FlowNode = {
      id: copyId,
      type: "step",
      selected: true,
      position: { x: original.position.x + 40, y: original.position.y + 110 },
      data: { step: { ...structuredClone(step), id: copyId, name: `${step.name} (copy)` } },
    };
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), copy]);
    setSelectedId(copyId);
    setIsDirty(true);
  }

  function disconnectStep(stepId: string) {
    setEdges((current) => current.filter((edge) => edge.source !== stepId && edge.target !== stepId));
    setIsDirty(true);
  }

  function deleteConnection(edgeId: string) {
    setEdges((current) => current.filter((edge) => edge.id !== edgeId));
    setIsDirty(true);
  }

  // For example, turns an ordinary connection into one that only runs when the step fails.
  function changeConnection(edgeId: string, handle: string) {
    setEdges((current) => {
      const old = current.find((edge) => edge.id === edgeId);
      if (!old) return current;
      const replacement = connectionToEdge(old.source, handle, old.target);
      const others = current.filter((edge) => edge.id !== edgeId);
      return others.some((edge) => edge.id === replacement.id) ? others : [...others, replacement];
    });
    setIsDirty(true);
  }

  function menuItems(open: OpenMenu): MenuItem[] {
    if (open.kind === "node") {
      const openSettings: MenuItem = { label: "Open settings", icon: <Settings2 size={15} aria-hidden="true" />, onSelect: () => setSelectedId(open.id) };
      if (open.id === TRIGGER_ID) return [openSettings];
      return [
        openSettings,
        { label: "Duplicate", icon: <Copy size={15} aria-hidden="true" />, onSelect: () => duplicateStep(open.id) },
        { label: "Remove its connections", icon: <Unlink size={15} aria-hidden="true" />, onSelect: () => disconnectStep(open.id) },
        "separator",
        { label: "Delete step", icon: <Trash2 size={15} aria-hidden="true" />, danger: true, onSelect: () => deleteStep(open.id) },
      ];
    }

    const edge = edges.find((item) => item.id === open.id);
    const sourceStep = nodes.find((node) => node.id === edge?.source)?.data.step;
    const switches: MenuItem[] = handlesFor(sourceStep)
      .filter((handle) => handle !== edge?.sourceHandle)
      .map((handle) => ({ label: BRANCH_LABELS[handle], icon: <ArrowRightLeft size={15} aria-hidden="true" />, onSelect: () => changeConnection(open.id, handle) }));

    return [
      ...switches,
      ...(switches.length > 0 ? ["separator" as const] : []),
      { label: "Delete connection", icon: <Trash2 size={15} aria-hidden="true" />, danger: true, onSelect: () => deleteConnection(open.id) },
    ];
  }

  function menuTitle(open: OpenMenu): string {
    if (open.kind === "edge") {
      const edge = edges.find((item) => item.id === open.id);
      const from = edge?.source === TRIGGER_ID ? "Trigger" : nodes.find((node) => node.id === edge?.source)?.data.step?.name;
      const to = nodes.find((node) => node.id === edge?.target)?.data.step?.name;
      return `${from ?? "Step"} → ${to ?? "Step"}`;
    }
    return open.id === TRIGGER_ID ? "Trigger" : nodes.find((node) => node.id === open.id)?.data.step?.name ?? "Step";
  }

  async function save(): Promise<boolean> {
    const found = findProblems(nodes, edges, connectorList);
    setProblems(found);
    if (found.length > 0) return false;

    setIsSaving(true);
    try {
      const saved = await api.saveDraft(workflowId, flowToDefinition(nodes, edges));
      if (name.trim() && name !== initial.name) await api.renameWorkflow(workflowId, name.trim());
      setPublication(saved.status);
      setIsDirty(false);
      return true;
    } catch (problem) {
      setProblems([(problem as Error).message]);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function publish() {
    const found = findProblems(nodes, edges, connectorList);
    setProblems(found);
    if (found.length > 0 || (isDirty && !(await save()))) return;

    setIsPublishing(true);
    try {
      const published = await api.publish(workflowId);
      setPublication(published.status);
      setPublishedVersion(published.versionNumber);
      setProblems([]);
    } catch (problem) {
      setProblems([(problem as Error).message]);
    } finally {
      setIsPublishing(false);
    }
  }

  async function testWorkflow() {
    if (isDirty && !(await save())) return;

    let data: unknown = {};
    try {
      if (testData.trim()) data = JSON.parse(testData);
    } catch {
      setProblems(["The test data is not valid JSON. Select the trigger to fix it."]);
      return;
    }

    try {
      setProblems([]);
      const started = await api.testWorkflow(workflowId, data);
      watchRun(started.id);
    } catch (problem) {
      setProblems([(problem as Error).message]);
    }
  }

  function watchRun(runId: string) {
    if (pollTimer.current) window.clearInterval(pollTimer.current);

    const check = async () => {
      const current = await api.getRun(runId);
      setLiveRun(current);
      // A waiting run can stay that way for days, so the builder stops watching it.
      if (current.status === "succeeded" || current.status === "failed" || current.status === "waiting") {
        if (pollTimer.current) window.clearInterval(pollTimer.current);
        await loadSamples();
      }
    };
    void check();
    pollTimer.current = window.setInterval(check, 1000);
  }

  const selectedNode = nodes.find((node) => node.id === selectedId);
  const selectedStep = selectedNode?.data.step;

  const dataGroups: DataGroup[] = useMemo(() => {
    if (!selectedStep) return [];
    const groups: DataGroup[] = [{ title: "Trigger", items: samples.trigger ? listSampleValues(samples.trigger, "trigger") : [] }];
    for (const stepId of stepsBefore(selectedStep.id, edges)) {
      const step = nodes.find((node) => node.id === stepId)?.data.step;
      const sample = samples.steps[stepId];
      if (step && sample) groups.push({ title: step.name, items: listSampleValues(sample.output, `steps.${stepId}.output`) });
    }
    return groups;
  }, [selectedStep, samples, edges, nodes]);

  async function testSelected(step: WorkflowStep) {
    let trigger: unknown = samples.trigger ?? {};
    if (hasEditedTestData) {
      try {
        trigger = JSON.parse(testData);
      } catch {
        return { ok: false, error: "The test data is not valid JSON." };
      }
    }
    const result = await api.testStep(workflowId, step, { trigger, steps: samples.steps });
    if (result.ok) setSamples((current) => ({ ...current, steps: { ...current.steps, [step.id]: { output: result.output } } }));
    return result;
  }

  const statuses = useMemo(() => statusMap(liveRun?.steps ?? []), [liveRun]);
  const isRunActive = liveRun?.status === "queued" || liveRun?.status === "running";

  const matchesSearch = (...texts: string[]) => texts.join(" ").toLowerCase().includes(stepSearch.trim().toLowerCase());

  const allCoreSteps: PaletteEntry[] = [
    { key: "core:http_request", label: "HTTP request", description: "Call any web API", icon: <HttpIcon />, baseId: "http_request", stepName: "HTTP request", make: (stepId, stepName) => ({ id: stepId, name: stepName, type: "http_request", config: { method: "GET", url: "", headers: {} } }) },
    { key: "core:if", label: "If / else", description: "Choose a path based on a condition", icon: <IfIcon />, baseId: "if_step", stepName: "If", make: (stepId, stepName) => ({ id: stepId, name: stepName, type: "if", config: { left: "", operator: "equals", right: "" } }) },
    { key: "core:delay", label: "Delay", description: "Wait for a set time before carrying on", icon: <DelayIcon />, baseId: "delay", stepName: "Delay", make: (stepId, stepName) => ({ id: stepId, name: stepName, type: "delay", config: { amount: 5, unit: "minutes" } }) },
    { key: "core:approval", label: "Approval", description: "Pause until a person approves or rejects", icon: <ApprovalIcon />, baseId: "approval", stepName: "Approval", make: (stepId, stepName) => ({ id: stepId, name: stepName, type: "approval", config: { message: "Please review this request.", timeoutHours: 24 } }) },
    { key: "core:loop", label: "Loop", description: "Repeat an action for each item in a list", icon: <LoopIcon />, baseId: "loop", stepName: "Loop", make: (stepId, stepName) => ({ id: stepId, name: stepName, type: "loop", config: { items: "", action: { type: "http_request", config: { method: "POST", url: "", headers: {} } } } }) },
  ];

  const allConnectorGroups = connectorList.map((connector) => ({
    connector,
    entries: connector.actions.map((action): PaletteEntry => ({
      key: `app:${connector.id}:${action.id}`,
      label: humanize(action.id),
      description: action.description,
      icon: <ServiceLogo connector={connector.id} />,
      baseId: `${connector.id}_${action.id}`,
      stepName: humanize(action.id),
      make: (stepId, stepName) => ({ id: stepId, name: stepName, type: "connector", config: { connector: connector.id, action: action.id, connectionId: (connections.data ?? []).find((item) => item.connector === connector.id)?.id ?? "", params: {} } }),
    })),
  }));

  // Finds the entry a dragged step came from.
  const paletteByKey = new Map([...allCoreSteps, ...allConnectorGroups.flatMap((group) => group.entries)].map((entry) => [entry.key, entry]));

  const coreSteps = allCoreSteps.filter((entry) => matchesSearch(entry.label, entry.description));
  const connectorGroups = allConnectorGroups
    .map(({ connector, entries }) => ({ connector, entries: entries.filter((entry) => matchesSearch(connector.name, entry.label, entry.description)) }))
    .filter((group) => group.entries.length > 0);

  return (
    <div className={`b-root ${view === "tile" ? "b-tile" : ""}`}>
      <header className="b-top">
        <Link className="btn btn-g btn-ic" to="/workflows" aria-label="Back to workflows"><ChevronLeft size={17} aria-hidden="true" /></Link>
        <input className="b-name" aria-label="Workflow name" readOnly={!canEdit} value={name} onChange={(event) => { setName(event.target.value); setIsDirty(true); }} />
        <span className={`badge b-desk ${publishedVersion === null ? "b-off" : "b-ok"}`}>{publishedVersion === null ? "Draft" : `Published, Version ${publishedVersion}`}</span>
        <span className="small muted b-desk">
          {!canEdit ? "Read-only" : isDirty ? "Unsaved changes" : publication === "published_with_edits" ? `Draft saved. Version ${publishedVersion} stays live.` : ""}
        </span>
        <div className="grow" />
        <div className="seg-ctl b-desk" role="group" aria-label="Node style">
          <button className={view === "card" ? "is-on" : ""} aria-pressed={view === "card"} onClick={() => setView("card")}><Rows3 size={13} aria-hidden="true" /> Card</button>
          <button className={view === "tile" ? "is-on" : ""} aria-pressed={view === "tile"} onClick={() => setView("tile")}><LayoutGrid size={13} aria-hidden="true" /> Tile</button>
        </div>
        {canEdit && (
          <>
            <button className="btn b-desk" onClick={save} disabled={!isDirty || isSaving}><Save size={14} aria-hidden="true" /> {isSaving ? "Saving..." : "Save"}</button>
            <button className="btn b-desk" onClick={testWorkflow} disabled={isRunActive} title="Runs for real, but is marked as a test and left out of the statistics"><FlaskConical size={14} aria-hidden="true" /> Test workflow</button>
            <button className="btn btn-p b-desk" onClick={publish} disabled={isPublishing || (publication === "published" && !isDirty)}><Rocket size={14} aria-hidden="true" /> {isPublishing ? "Publishing..." : "Publish"}</button>
          </>
        )}
      </header>

      {problems.length > 0 && (
        <div className="notice err" style={{ borderRadius: 0 }} role="alert">
          <div className="col">{problems.map((problem) => <span key={problem}>{problem}</span>)}</div>
        </div>
      )}

      <div className="b-body">
        {canEdit && <aside className="b-pal" aria-label="Add a step">
          <div className="pal-title">What happens next?</div>
          <div className="pal-search">
            <span className="search-ic"><Search size={14} aria-hidden="true" /></span>
            <input className="input" type="search" aria-label="Search steps" placeholder="Search steps and apps" value={stepSearch} onChange={(event) => setStepSearch(event.target.value)} />
          </div>
          <div className="b-pal-scroll">
            {coreSteps.length > 0 && <div className="pal-h">CORE</div>}
            {coreSteps.map((entry) => <PaletteItem key={entry.key} entry={entry} onAdd={() => addStep(entry)} />)}
            {connectorGroups.map(({ connector, entries }) => (
              <div key={connector.id}>
                <div className="pal-h">{connector.name.toUpperCase()}</div>
                {entries.map((entry) => <PaletteItem key={entry.key} entry={entry} onAdd={() => addStep(entry)} />)}
              </div>
            ))}
            {coreSteps.length === 0 && connectorGroups.length === 0 && <p className="hint pal-none">No steps match your search.</p>}
          </div>
        </aside>}

        <main className="b-center" style={{ position: "relative" }}>
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            statuses={statuses}
            readOnly={!canEdit}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onSelect={setSelectedId}
            onNodeMenu={(nodeId, at) => setOpenMenu({ kind: "node", id: nodeId, at })}
            onEdgeMenu={(edgeId, at) => setOpenMenu({ kind: "edge", id: edgeId, at })}
            onDropStep={(paletteKey, position) => {
              const entry = paletteByKey.get(paletteKey);
              if (entry) addStep(entry, position);
            }}
          />
          {openMenu && <CanvasMenu at={openMenu.at} title={menuTitle(openMenu)} items={menuItems(openMenu)} onClose={() => setOpenMenu(null)} />}
          {liveRun && (
            <div className="hint-bar is-live" role="status">
              <StatusBadge status={liveRun.status} />
              {!isRunActive && <span>{formatDuration(liveRun.startedAt, liveRun.finishedAt)}</span>}
              <Link to={`/executions/${liveRun.id}`}>View details</Link>
            </div>
          )}
        </main>

        {selectedNode && (
          <aside className="b-cfg" aria-label="Settings">
            <fieldset className="plain-fieldset" disabled={!canEdit}>
            {selectedStep ? (
              <StepPanel
                key={selectedStep.id}
                step={selectedStep}
                groups={dataGroups}
                connectors={connectorList}
                connections={connections.data ?? []}
                onChange={updateStep}
                onDelete={() => deleteStep(selectedStep.id)}
                onTest={() => testSelected(selectedStep)}
              />
            ) : (
              <TriggerPanel
                workflow={initial}
                triggers={triggers.data ?? []}
                connections={connections.data ?? []}
                testData={testData}
                onTestDataChange={(value) => { setTestData(value); setHasEditedTestData(true); }}
                onChanged={triggers.reload}
              />
            )}
            </fieldset>
          </aside>
        )}
      </div>

      <div className="b-small-screen"><p className="muted">The workflow builder needs a larger screen. Please open it on a computer.</p></div>
    </div>
  );
}

// An If step fills its True branch first, then its False branch.
function chooseHandle(source: FlowNode, edges: Edge[]): string {
  if (source.id === TRIGGER_ID) return "start";
  const hasBranch = (handle: string) => edges.some((edge) => edge.source === source.id && edge.sourceHandle === handle);
  if (source.data.step?.type === "if") return hasBranch("true") ? "false" : "true";
  if (source.data.step?.type === "approval") return hasBranch("approved") ? "rejected" : "approved";
  return "success";
}
