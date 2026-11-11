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

    // Listens before anything else on the page. The builder's canvas swallows a press that
    // starts a drag, so a normal listener would never hear it and the panel would stay open.
    document.addEventListener("mousedown", closeWhenClickedOutside, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeWhenClickedOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [container, isOpen, close]);
}
