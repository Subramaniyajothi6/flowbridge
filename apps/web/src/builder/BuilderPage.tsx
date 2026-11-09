import { addEdge, useEdgesState, useNodesState, type Connection as FlowConnection, type Edge, type EdgeChange, type NodeChange } from "@xyflow/react";
import { ChevronLeft, LayoutGrid, Play, Rows3, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.ts";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { HttpIcon, IfIcon, ServiceLogo } from "../components/StepIcon.tsx";
import { formatDuration, humanize } from "../format.ts";
import type { ConnectorInfo, RunDetail, Samples, Trigger, WorkflowDetail, WorkflowStep } from "../types.ts";
import { useLoad } from "../useLoad.ts";
import type { DataGroup } from "./fields.tsx";
import { connectionToEdge, definitionToFlow, findProblems, flowToDefinition, listSampleValues, statusMap, stepsBefore, TRIGGER_ID, uniqueStepId, wouldCreateLoop, type FlowNode } from "./flow.ts";
import { StepPanel } from "./StepPanel.tsx";
import { TriggerPanel } from "./TriggerPanel.tsx";
import { WorkflowCanvas } from "./WorkflowCanvas.tsx";

const COLUMN_GAP = 300;

function summarize(triggers: Trigger[]): string {
  const active = triggers.filter((trigger) => trigger.enabled).length;
  return active === 0 ? "Manual or webhook" : `Manual, webhook + ${active} more`;
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
  const latest = initial.versions[0];

  const flow = useMemo(() => definitionToFlow(latest.definition, "Manual or webhook"), [latest]);
  const [nodes, setNodes, applyNodeChanges] = useNodesState<FlowNode>(flow.nodes);
  const [edges, setEdges, applyEdgeChanges] = useEdgesState<Edge>(flow.edges);

  const [name, setName] = useState(initial.name);
  const [version, setVersion] = useState(latest.versionNumber);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"card" | "tile">("card");
  const [testData, setTestData] = useState("{\n  \n}");
  const [samples, setSamples] = useState<Samples>({ trigger: null, steps: {} });
  const [liveRun, setLiveRun] = useState<RunDetail | null>(null);
  const [hasEditedTestData, setHasEditedTestData] = useState(false);

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

  // Adds a step after the selected one, or at the end of the workflow.
  function addStep(make: (id: string, name: string) => WorkflowStep, baseId: string, stepName: string) {
    const stepId = uniqueStepId(baseId, nodes);
    const source = nodes.find((node) => node.id === selectedId) ?? nodes.filter((node) => !edges.some((edge) => edge.source === node.id)).at(-1) ?? nodes[0];

    const newNode: FlowNode = {
      id: stepId,
      type: "step",
      selected: true,
      position: { x: source.position.x + COLUMN_GAP, y: source.position.y + edges.filter((edge) => edge.source === source.id).length * 130 },
      data: { step: make(stepId, stepName) },
    };

    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), newNode]);
    setEdges((current) => [...current, connectionToEdge(source.id, chooseHandle(source, current), stepId)]);
    setSelectedId(stepId);
    setIsDirty(true);
  }

  async function save(): Promise<boolean> {
    const found = findProblems(nodes, edges, connectorList);
    setProblems(found);
    if (found.length > 0) return false;

    setIsSaving(true);
    try {
      await api.saveVersion(workflowId, flowToDefinition(nodes, edges));
      if (name.trim() && name !== initial.name) await api.renameWorkflow(workflowId, name.trim());
      setVersion((current) => current + 1);
      setIsDirty(false);
      return true;
    } catch (problem) {
      setProblems([(problem as Error).message]);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function run() {
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
      const started = await api.startRun(workflowId, data);
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
      if (current.status === "succeeded" || current.status === "failed") {
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

  return (
    <div className={`b-root ${view === "tile" ? "b-tile" : ""}`}>
      <header className="b-top">
        <Link className="btn btn-g btn-ic" to="/workflows" aria-label="Back to workflows"><ChevronLeft size={17} aria-hidden="true" /></Link>
        <input className="b-name" aria-label="Workflow name" value={name} onChange={(event) => { setName(event.target.value); setIsDirty(true); }} />
        <span className="small muted b-desk">Version {version}{isDirty ? ", unsaved changes" : ""}</span>
        <div className="grow" />
        <div className="seg-ctl b-desk" role="group" aria-label="Node style">
          <button className={view === "card" ? "is-on" : ""} aria-pressed={view === "card"} onClick={() => setView("card")}><Rows3 size={13} aria-hidden="true" /> Card</button>
          <button className={view === "tile" ? "is-on" : ""} aria-pressed={view === "tile"} onClick={() => setView("tile")}><LayoutGrid size={13} aria-hidden="true" /> Tile</button>
        </div>
        <button className="btn b-desk" onClick={save} disabled={!isDirty || isSaving}><Save size={14} aria-hidden="true" /> {isSaving ? "Saving..." : "Save"}</button>
        <button className="btn btn-p b-desk" onClick={run} disabled={isRunActive}><Play size={14} aria-hidden="true" /> Run</button>
      </header>

      {problems.length > 0 && (
        <div className="notice err" style={{ borderRadius: 0 }} role="alert">
          <div className="col">{problems.map((problem) => <span key={problem}>{problem}</span>)}</div>
        </div>
      )}

      <div className="b-body">
        <aside className="b-pal" aria-label="Add a step">
          <div className="b-pal-scroll">
            <div className="pal-h">CORE</div>
            <button className="pal-i" onClick={() => addStep((stepId, stepName) => ({ id: stepId, name: stepName, type: "http_request", config: { method: "GET", url: "", headers: {} } }), "http_request", "HTTP request")}>
              <HttpIcon /> HTTP request
            </button>
            <button className="pal-i" onClick={() => addStep((stepId, stepName) => ({ id: stepId, name: stepName, type: "if", config: { left: "", operator: "equals", right: "" } }), "if_step", "If")}>
              <IfIcon /> If / else
            </button>
            {connectorList.map((connector) => (
              <div key={connector.id}>
                <div className="pal-h">{connector.name.toUpperCase()}</div>
                {connector.actions.map((action) => (
                  <button
                    key={action.id}
                    className="pal-i"
                    title={action.description}
                    onClick={() => addStep(
                      (stepId, stepName) => ({ id: stepId, name: stepName, type: "connector", config: { connector: connector.id, action: action.id, connectionId: (connections.data ?? []).find((item) => item.connector === connector.id)?.id ?? "", params: {} } }),
                      `${connector.id}_${action.id}`,
                      humanize(action.id),
                    )}
                  >
                    <ServiceLogo connector={connector.id} /> {humanize(action.id)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <main className="b-center" style={{ position: "relative" }}>
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            statuses={statuses}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onSelect={setSelectedId}
          />
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
  if (source.data.step?.type !== "if") return "success";
  return edges.some((edge) => edge.source === source.id && edge.sourceHandle === "true") ? "false" : "true";
}
