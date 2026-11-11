import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { createContext, useContext } from "react";
import { DesignIcon } from "../components/DesignIcon.tsx";

// What the line buttons can do, given by the builder.
export type EdgeActions = {
  hoveredId: string | null;
  setHovered: (edgeId: string | null) => void;
  insertInto: (edgeId: string) => void;
  remove: (edgeId: string) => void;
};

export const EdgeActionsContext = createContext<EdgeActions | null>(null);

// Every connection on the canvas. Pointing at one shows two buttons in its middle:
// insert a step here, and remove the connection.
export function ToolEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, markerEnd, style, selected, sourceHandleId } = props;
  const actions = useContext(EdgeActionsContext);

  // An error path leaves from the dot under a card. A curve would bend back up behind the card
  // and hide its label, so it is drawn with square corners that run below the cards instead.
  const isErrorPath = sourceHandleId === "error";
  const pathInput = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
  const [path, labelX, labelY] = isErrorPath ? getSmoothStepPath({ ...pathInput, offset: 28, borderRadius: 10 }) : getBezierPath(pathInput);

  const showTools = actions !== null && (actions.hoveredId === id || selected);

  return (
    <>
      <BaseEdge id={id} path={path} label={label} labelX={labelX} labelY={labelY} markerEnd={markerEnd} style={style} interactionWidth={24} />
      {showTools && (
        <EdgeLabelRenderer>
          <div
            className="e-tools row nodrag nopan"
            // Sits under the label when there is one, so both stay readable.
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + (label ? 22 : 0)}px)` }}
            onMouseEnter={() => actions.setHovered(id)}
            onMouseLeave={() => actions.setHovered(null)}
          >
            <button className="btn btn-g btn-sm btn-ic" aria-label="Insert a step in this connection" title="Insert a step here" onClick={() => actions.insertInto(id)}>
              <DesignIcon name="plus" />
            </button>
            <button className="btn btn-g btn-sm btn-ic is-danger" aria-label="Remove this connection" title="Remove this connection" onClick={() => actions.remove(id)}>
              <DesignIcon name="trash" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const edgeTypes = { default: ToolEdge };
