import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import type { StepStatus } from "../types.ts";
import type { FlowNode } from "./flow.ts";
import { nodeTypes, StepStatusContext } from "./nodes.tsx";

type Props = {
  nodes: FlowNode[];
  edges: Edge[];
  statuses: Map<string, StepStatus>;
  readOnly?: boolean;
  onNodesChange?: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange?: (changes: EdgeChange[]) => void;
  onConnect?: (connection: Connection) => void;
  isValidConnection?: (connection: Connection | Edge) => boolean;
  onSelect?: (nodeId: string | null) => void;
};

// Used for editing in the builder, and read-only on the execution screen.
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
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          {!readOnly && <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#cdcdce" />}
          {!readOnly && <Controls showInteractive={false} />}
        </ReactFlow>
      </div>
    </StepStatusContext.Provider>
  );
}
