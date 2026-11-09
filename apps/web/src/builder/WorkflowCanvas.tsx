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
} from "@xyflow/react";
import { useEffect, useRef } from "react";
import type { StepStatus } from "../types.ts";
import type { FlowNode } from "./flow.ts";
import { nodeTypes, StepStatusContext } from "./nodes.tsx";

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

export function WorkflowCanvas({ nodes, edges, statuses, readOnly, onNodesChange, onEdgesChange, onConnect, isValidConnection, onSelect }: Props) {
  return (
    <StepStatusContext.Provider value={statuses}>
      <div className="fb-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onNodeClick={(_event, node) => onSelect?.(node.id)}
          onPaneClick={() => onSelect?.(null)}
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
