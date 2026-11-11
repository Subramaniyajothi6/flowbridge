import {
  Background,
  BackgroundVariant,
  ReactFlow,
  useReactFlow,
  useStore,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type OnConnectEnd,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { DesignIcon } from "../components/DesignIcon.tsx";
import type { StepStatus } from "../types.ts";
import { EdgeActionsContext, edgeTypes, type EdgeActions } from "./edges.tsx";
import type { FlowNode } from "./flow.ts";
import { nodeTypes, StepActionsContext, StepStatusContext, type StepActions } from "./nodes.tsx";

type Point = { x: number; y: number };

type Props = {
  nodes: FlowNode[];
  edges: Edge[];
  statuses: Map<string, StepStatus>;
  // For a role that can look at a workflow but not change it.
  readOnly?: boolean;
  view: "card" | "tile";
  onToggleView: () => void;
  onTidy?: () => void;
  onNodesChange?: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange?: (changes: EdgeChange[]) => void;
  onConnect?: (connection: Connection) => void;
  isValidConnection?: (connection: Connection | Edge) => boolean;
  onSelect?: (nodeId: string | null) => void;
  // Right-clicks, with the place on screen where the menu should open.
  onNodeMenu?: (nodeId: string, at: Point) => void;
  onEdgeMenu?: (edgeId: string, at: Point) => void;
  // When the view moves or zooms, or a card is dragged. A right-click menu closes then,
  // because it would otherwise float over a different card.
  onCanvasMove?: () => void;
  // Gives the builder the canvas, so a step dragged from the left panel can be placed.
  onReady?: (instance: ReactFlowInstance<FlowNode, Edge>) => void;
  stepActions?: StepActions;
  onInsertInto?: (edgeId: string) => void;
  onRemoveEdge?: (edgeId: string) => void;
};

const FIT_OPTIONS = { padding: 0.2, maxZoom: 1 };

// How long the line buttons stay after the pointer leaves the line, so they can be reached.
const HOVER_GRACE_MS = 200;

// Opening the settings panel makes the canvas narrower.
// Refitting the view keeps every step visible instead of hiding some behind the panel.
function KeepStepsInView() {
  const canvasWidth = useStore((state) => state.width);
  const { fitView } = useReactFlow();
  const previousWidth = useRef(canvasWidth);

  useEffect(() => {
    const isFirstMeasurement = previousWidth.current === 0;
    const hasChanged = previousWidth.current !== canvasWidth;
    previousWidth.current = canvasWidth;
    if (hasChanged && !isFirstMeasurement) void fitView({ ...FIT_OPTIONS, duration: 200 });
  }, [canvasWidth, fitView]);

  return null;
}

// The bar at the bottom left: card or tile view, zoom, fit, and tidy up.
function CanvasTools({ view, onToggleView, onTidy }: { view: "card" | "tile"; onToggleView: () => void; onTidy?: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoomPercent = useStore((state) => Math.round(state.transform[2] * 100));

  return (
    <div className="canvas-tools" role="group" aria-label="Zoom">
      <button className="btn btn-g btn-sm canvas-view" aria-pressed={view === "tile"} title="Switch how steps are drawn" onClick={onToggleView}>
        {view === "tile" ? "Card view" : "Tile view"}
      </button>
      <button className="btn btn-g btn-sm btn-ic" aria-label="Zoom out" onClick={() => zoomOut({ duration: 150 })}><DesignIcon name="minus" /></button>
      <span className="pct">{zoomPercent}%</span>
      <button className="btn btn-g btn-sm btn-ic" aria-label="Zoom in" onClick={() => zoomIn({ duration: 150 })}><DesignIcon name="plus" /></button>
      <button className="btn btn-g btn-sm btn-ic" aria-label="Fit workflow to view" title="Fit to view" onClick={() => fitView({ ...FIT_OPTIONS, duration: 200 })}><DesignIcon name="fit" /></button>
      {onTidy && (
        <button className="btn btn-g btn-sm btn-ic" aria-label="Tidy up the workflow" title="Tidy up: arrange steps automatically" onClick={onTidy}><DesignIcon name="tidy" /></button>
      )}
    </div>
  );
}

function pointerOf(event: MouseEvent | TouchEvent): Point {
  if ("changedTouches" in event) return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
  return { x: event.clientX, y: event.clientY };
}

export function WorkflowCanvas(props: Props) {
  const { nodes, edges, statuses, readOnly, view, onToggleView, onTidy, onNodesChange, onEdgesChange, onConnect, isValidConnection, onSelect, onNodeMenu, onEdgeMenu, onCanvasMove, onReady, stepActions, onInsertInto, onRemoveEdge } = props;
  const [isConnecting, setIsConnecting] = useState(false);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const leaveTimer = useRef<number | null>(null);

  // Letting go of a line anywhere on a card connects it to that card, not only on its small dot.
  const connectToCardUnderPointer: OnConnectEnd = (event, state) => {
    setIsConnecting(false);
    if (state.isValid || !state.fromNode || state.fromHandle?.type !== "source") return;

    const { x, y } = pointerOf(event);
    const card = document.elementFromPoint(x, y)?.closest(".react-flow__node");
    const target = card?.getAttribute("data-id");
    if (!target) return;

    const connection: Connection = { source: state.fromNode.id, sourceHandle: state.fromHandle.id ?? null, target, targetHandle: null };
    if (isValidConnection?.(connection) ?? true) onConnect?.(connection);
  };

  // Moving from the line onto its buttons briefly leaves the line, so hiding waits a moment.
  function setHovered(edgeId: string | null) {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    if (edgeId) setHoveredEdge(edgeId);
    else leaveTimer.current = window.setTimeout(() => setHoveredEdge(null), HOVER_GRACE_MS);
  }

  const edgeActions: EdgeActions | null = readOnly || !onInsertInto || !onRemoveEdge ? null : {
    hoveredId: hoveredEdge,
    setHovered,
    insertInto: (edgeId) => {
      setHoveredEdge(null);
      onInsertInto(edgeId);
    },
    remove: (edgeId) => {
      setHoveredEdge(null);
      onRemoveEdge(edgeId);
    },
  };

  return (
    <StepStatusContext.Provider value={statuses}>
      <StepActionsContext.Provider value={readOnly ? null : stepActions ?? null}>
        <EdgeActionsContext.Provider value={edgeActions}>
          <div className={`fb-canvas ${isConnecting ? "is-connecting" : ""}`}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onInit={(instance) => onReady?.(instance)}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onConnectStart={() => setIsConnecting(true)}
              onConnectEnd={connectToCardUnderPointer}
              // A line snaps to a dot when let go this close to it, in pixels.
              connectionRadius={40}
              isValidConnection={isValidConnection}
              onNodeClick={(_event, node) => onSelect?.(node.id)}
              onPaneClick={() => onSelect?.(null)}
              onEdgeMouseEnter={(_event, edge) => setHovered(edge.id)}
              onEdgeMouseLeave={() => setHovered(null)}
              onNodeContextMenu={(event, node) => {
                if (readOnly) return;
                event.preventDefault();
                onNodeMenu?.(node.id, { x: event.clientX, y: event.clientY });
              }}
              onEdgeContextMenu={(event, edge) => {
                if (readOnly) return;
                event.preventDefault();
                onEdgeMenu?.(edge.id, { x: event.clientX, y: event.clientY });
              }}
              onMoveStart={() => onCanvasMove?.()}
              onNodeDragStart={() => onCanvasMove?.()}
              nodesDraggable={!readOnly}
              nodesConnectable={!readOnly}
              edgesFocusable={!readOnly}
              deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
              fitView
              fitViewOptions={FIT_OPTIONS}
              minZoom={0.3}
              maxZoom={1.5}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#cdcdce" />
              <CanvasTools view={view} onToggleView={onToggleView} onTidy={readOnly ? undefined : onTidy} />
              <KeepStepsInView />
            </ReactFlow>
          </div>
        </EdgeActionsContext.Provider>
      </StepActionsContext.Provider>
    </StepStatusContext.Provider>
  );
}
