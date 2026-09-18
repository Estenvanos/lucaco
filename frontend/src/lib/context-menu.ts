import type { MouseEvent } from "react";

/**
 * Right-click handler: opens a popover="auto" menu at the cursor (the one nested in the clicked
 * element unless `menu` is given). From the keyboard (Shift+F10) the event has no position, so it
 * opens over the element. No menu found: the browser's own menu shows.
 */
export function openContextMenu(
  event: MouseEvent<HTMLElement>,
  menu = event.currentTarget.querySelector<HTMLElement>("[popover]"),
) {
  if (!menu) return;
  event.preventDefault();
  const box = event.currentTarget.getBoundingClientRect();
  const keyboard = event.clientX === 0 && event.clientY === 0;
  menu.showPopover();
  const x = keyboard ? box.left + box.width / 2 : event.clientX;
  const y = keyboard ? box.top + box.height / 2 : event.clientY;
  // Measured after showing: keep the whole menu inside the viewport.
  menu.style.left = `${Math.min(x, innerWidth - menu.offsetWidth - 8)}px`;
  menu.style.top = `${Math.min(y, innerHeight - menu.offsetHeight - 8)}px`;
}
