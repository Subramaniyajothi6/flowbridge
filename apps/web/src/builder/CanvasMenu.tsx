import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useDismiss } from "../components/useDismiss.ts";

export type MenuItem = { label: string; icon: ReactNode; onSelect: () => void; danger?: boolean } | "separator";

// The menu shown when a card or a connection is right-clicked.
export function CanvasMenu({ at, title, items, onClose }: { at: { x: number; y: number }; title: string; items: MenuItem[]; onClose: () => void }) {
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(at);
  useDismiss(menu, true, onClose);

  // Opens beside the pointer, but moves back inside the window if it would spill off the edge.
  useLayoutEffect(() => {
    const box = menu.current?.getBoundingClientRect();
    if (!box) return;
    setPosition({
      x: Math.min(at.x, window.innerWidth - box.width - 8),
      y: Math.min(at.y, window.innerHeight - box.height - 8),
    });
  }, [at]);

  return (
    <div ref={menu} className="pop canvas-menu" role="menu" aria-label={title} style={{ left: position.x, top: position.y }}>
      <div className="menu-h">{title}</div>
      {items.map((item, index) =>
        item === "separator" ? <div key={`separator-${index}`} className="menu-sep" /> : (
          <button
            key={item.label}
            role="menuitem"
            className={`menu-i ${item.danger ? "danger" : ""}`}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            {item.icon} {item.label}
          </button>
        ),
      )}
    </div>
  );
}
