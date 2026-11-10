import { useEffect, type RefObject } from "react";

// Closes a small pop-up panel when the person clicks outside it or presses Escape.
export function useDismiss(container: RefObject<HTMLElement | null>, isOpen: boolean, close: () => void): void {
  useEffect(() => {
    if (!isOpen) return;

    const closeWhenClickedOutside = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) close();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", closeWhenClickedOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeWhenClickedOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [container, isOpen, close]);
}
