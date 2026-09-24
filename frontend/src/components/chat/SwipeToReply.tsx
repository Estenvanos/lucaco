import { useRef, type PointerEvent } from "react";
import type { SwipeToReplyProps } from "../../types/ui.types";

/** Past this many pixels to the right, letting go replies. The message follows up to MAX. */
const TRIGGER = 60;
const MAX = 80;
/** Movement before deciding whether it is a swipe or a scroll / text selection. */
const SLOP = 10;

/** Controls inside a message keep their own drag (seek bar, links, buttons). */
const INTERACTIVE = "button, a, input, audio, video, textarea";

/**
 * Drag a message to the right to reply to it (touch, pen or mouse). Vertical movement is left to
 * the scroll (`touch-action: pan-y`). Plain refs and inline styles: no re-render while dragging.
 */
export function SwipeToReply({ onReply, children }: SwipeToReplyProps) {
  const drag = useRef<{ x: number; y: number; dx: number; swiping: boolean } | null>(null);

  const slide = (el: HTMLElement, dx: number) => {
    el.style.transform = dx ? `translateX(${dx}px)` : "";
    el.style.transition = dx ? "none" : "";
    el.toggleAttribute("data-swiping", !!dx); // no text selection while dragging
  };

  const end = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    drag.current = null;
    if (!state?.swiping) return;
    slide(event.currentTarget, 0);
    if (state.dx >= TRIGGER && event.type === "pointerup") onReply();
  };

  return (
    <div
      className="chat-swipe"
      onPointerDown={(event) => {
        if (event.button !== 0 || (event.target as HTMLElement).closest(INTERACTIVE)) return;
        drag.current = { x: event.clientX, y: event.clientY, dx: 0, swiping: false };
      }}
      onPointerMove={(event) => {
        const state = drag.current;
        if (!state) return;
        const dx = event.clientX - state.x;
        const dy = event.clientY - state.y;
        if (!state.swiping) {
          if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) drag.current = null; // a scroll
          else if (dx > SLOP) {
            state.swiping = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            window.getSelection()?.removeAllRanges(); // a mouse drag had started selecting text
          }
          if (!state.swiping) return;
        }
        state.dx = Math.min(Math.max(dx, 0), MAX);
        slide(event.currentTarget, state.dx);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {children}
    </div>
  );
}
