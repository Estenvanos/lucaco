import type { KeyboardEvent, PointerEvent } from "react";

/** Where one item sits on the arc, already resolved to CSS values. */
export type WheelSlot = {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  /** Items past the edge of the arc are not rendered at all. */
  visible: boolean;
  active: boolean;
};

export type WheelControls = {
  slots: WheelSlot[];
  active: number;
  dragging: boolean;
  /** Locked: drag and arrow keys no longer turn the wheel. */
  locked: boolean;
  toggleLock: () => void;
  select: (index: number) => void;
  /** True if the pointer moved enough since pointerdown to count as a drag, not a click. */
  wasDrag: () => boolean;
  handlers: {
    onPointerDown: (event: PointerEvent) => void;
    onPointerMove: (event: PointerEvent) => void;
    onPointerUp: (event: PointerEvent) => void;
    onKeyDown: (event: KeyboardEvent) => void;
  };
};
