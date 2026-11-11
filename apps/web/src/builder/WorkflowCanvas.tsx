import {
  Background,
  BackgroundVariant,
  Controls,
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
import { useEffect, useRef, useState, type DragEvent } from "react";
import type { StepStatus } from "../types.ts";
import type { FlowNode } from "./flow.ts";
import { nodeTypes, StepStatusContext } from "./nodes.tsx";

// The type used when a step is dragged from the left panel, so other dragged things are ignored.
export const STEP_DRAG_TYPE = "application/x-flowbridge-step";

// Half a card, so a dropped step lands centred on the pointer.
const HALF_CARD = { x: 112, y: 46 };

type Point = { x: number; y: number };

type Props = {
  nodes: FlowNode[];
  edges: Edge[];
  statuses: Map<string, StepStatus>;
  // For a role that can look at a workflow but not change it.
  readOnly?: boolean;
  onNodesChange?: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange?: (changes: EdgeChange[]) => void;
  onConnect?: (connection: Connection) => void;
  isValidConnection?: (connection: Connection | Edge) => boolean;
  onSelect?: (nodeId: string | null) => void;
  // Right-clicks, with the place on screen where the menu should open.
  onNodeMenu?: (nodeId: string, at: Point) => void;
  onEdgeMenu?: (edgeId: string, at: Point) => void;
  onDropStep?: (paletteKey: string, position: Point) => void;
};

const FIT_OPTIONS = { padding: 0.2, maxZoom: 1 };

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

function pointerOf(event: MouseEvent | TouchEvent): Point {
  if ("changedTouches" in event) return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
  return { x: event.clientX, y: event.clientY };
}

export function WorkflowCanvas({ nodes, edges, statuses, readOnly, onNodesChange, onEdgesChange, onConnect, isValidConnection, onSelect, onNodeMenu, onEdgeMenu, onDropStep }: Props) {
  const flow = useRef<ReactFlowInstance<FlowNode, Edge> | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

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

  function allowStepDrop(event: DragEvent) {
    if (readOnly || !event.dataTransfer.types.includes(STEP_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function dropStep(event: DragEvent) {
    const paletteKey = event.dataTransfer.getData(STEP_DRAG_TYPE);
    if (readOnly || !paletteKey || !flow.current) return;
    event.preventDefault();
    const point = flow.current.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    onDropStep?.(paletteKey, { x: point.x - HALF_CARD.x, y: point.y - HALF_CARD.y });
  }

  return (
    <StepStatusContext.Provider value={statuses}>
      <div className={`fb-canvas ${isConnecting ? "is-connecting" : ""}`} onDragOver={allowStepDrop} onDrop={dropStep}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={(instance) => { flow.current = instance; }}
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
          <Controls showInteractive={false} />
          <KeepStepsInView />
        </ReactFlow>
      </div>
    </StepStatusContext.Provider>
  );
}
