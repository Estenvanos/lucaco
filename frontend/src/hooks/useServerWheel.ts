import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ringDelta } from "../lib/utils";
import type { WheelControls, WheelSlot } from "../types/wheel.types";

/** Arc geometry. RADIUS_X is small on purpose: the column is narrow, so the bulge is subtle. */
const STEP = 0.42; // radians between neighbours
const RADIUS_X = 42;
const RADIUS_Y = 190;
const EDGE = 1.45; // past this angle the item has left the arc
const DRAG_PX_PER_STEP = 62;

const railX = (angle: number) => -RADIUS_X * (1 - Math.cos(angle));
const railY = (angle: number) => RADIUS_Y * Math.sin(angle);

/**
 * The rail the items ride on: same pixel space, same two radii, so it runs through the centre of
 * every icon and hides behind them. Sampled a bit past EDGE so the line runs off the wheel
 * instead of stopping in mid-air.
 */
export const RAIL_PATH = Array.from({ length: 33 }, (_, i) => {
  const angle = -EDGE - 0.3 + (i * (2 * (EDGE + 0.3))) / 32;
  return `${i === 0 ? "M" : "L"}${railX(angle).toFixed(1)} ${railY(angle).toFixed(1)}`;
}).join(" ");

/** Tall enough for the arc plus half an item (1.5rem = 24px) at each end, and no more. */
export const WHEEL_HEIGHT = Math.ceil(2 * (railY(EDGE) + 24));

function slotAt(angle: number, active: boolean): WheelSlot {
  const away = Math.abs(angle);
  return {
    x: railX(angle),
    y: railY(angle),
    scale: 0.58 + 0.42 * Math.cos(angle),
    opacity: away > EDGE ? 0 : 0.35 + 0.65 * Math.cos(angle),
    visible: away <= EDGE,
    active,
  };
}

/**
 * Cursor-driven wheel: drag or scroll moves a floating offset, releasing snaps it to the nearest
 * item. The offset is the only state — every position is derived from it while rendering. It
 * never stops at either end: the slots wrap, so the wheel turns through 360°.
 */
export function useServerWheel(
  count: number,
  focusIndex = 0,
  onSettle?: (index: number) => void,
): WheelControls {
  const [offset, setOffset] = useState(focusIndex);
  const [dragging, setDragging] = useState(false);
  const [locked, setLocked] = useState(false);
  const drag = useRef<{ y: number; offset: number } | null>(null);

  // Route changed (opened a server, just created one): bring it to the centre. Adjusting state
  // while rendering is React's own answer to "derive from props" — an effect would render twice.
  const [lastFocus, setLastFocus] = useState(focusIndex);
  if (focusIndex !== lastFocus) {
    setLastFocus(focusIndex);
    // Turn the short way round instead of unwinding the whole ring.
    setOffset(offset + ringDelta(focusIndex, offset, count));
  }

  const indexAt = (value: number) => ((Math.round(value) % count) + count) % count;
  const active = indexAt(offset);
  const slots = Array.from({ length: count }, (_, i) =>
    slotAt(ringDelta(i, offset, count) * STEP, i === active),
  );

  return {
    slots,
    active,
    dragging,
    locked,
    toggleLock: () => setLocked(!locked),
    select: (index: number) => setOffset(offset + ringDelta(index, offset, count)),
    handlers: {
      // No wheel handler on purpose: the ring turns only while the pointer is held down, so
      // scrolling the page over the sidebar never spins it by accident.
      onPointerDown: (event: PointerEvent) => {
        if (locked) return;
        const el = event.currentTarget as HTMLElement;
        // Capture keeps the drag alive outside the column; an unknown pointer id just throws,
        // and losing capture is not a reason to lose the drag.
        try {
          el.setPointerCapture(event.pointerId);
        } catch {
          /* no capture, the drag still works while the pointer stays inside */
        }
        drag.current = { y: event.clientY, offset };
        setDragging(true);
      },
      onPointerMove: (event: PointerEvent) => {
        if (!drag.current) return;
        setOffset(drag.current.offset - (event.clientY - drag.current.y) / DRAG_PX_PER_STEP);
      },
      onPointerUp: (event: PointerEvent) => {
        const el = event.currentTarget as HTMLElement;
        if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
        // A drag that ends on another item opens it; a plain click leaves that to the item.
        if (drag.current && indexAt(drag.current.offset) !== active) onSettle?.(active);
        drag.current = null;
        setDragging(false);
        setOffset(Math.round(offset)); // snap
      },
      onKeyDown: (event: KeyboardEvent) => {
        const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
        if (!step || locked) return;
        event.preventDefault();
        setOffset(Math.round(offset) + step);
      },
    },
  };
}
