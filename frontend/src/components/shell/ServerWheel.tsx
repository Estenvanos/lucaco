import {
  RAIL_PATH,
  useServerWheel,
  WHEEL_HEIGHT,
} from "../../hooks/useServerWheel";
import type { ServerWheelProps } from "../../types/ui.types";
import { ServerAvatar } from "../servers/ServerAvatar";

/** Slot 0 is the add button, so a fresh account still has something on the wheel. */
export function ServerWheel({
  servers,
  activeServerId,
  onOpenServer,
  onAdd,
}: ServerWheelProps) {
  // Slot 0 is the add button, so a server's slot is its list position plus one.
  const activeIndex = servers.findIndex((s) => s.id === activeServerId) + 1;
  // Dragging onto the add slot does nothing: the dialog opens only on a real click.
  const wheel = useServerWheel(servers.length + 1, activeIndex, (index) => {
    if (index > 0) onOpenServer(servers[index - 1].id);
  });
  const { slots, dragging, locked, toggleLock, select, handlers } = wheel;

  const open = (index: number) => {
    select(index);
    if (index === 0) onAdd();
    else onOpenServer(servers[index - 1].id);
  };

  return (
    <div className="wheel-dock">
      <div
        className="wheel"
        data-dragging={dragging}
        data-locked={locked}
        style={{ height: WHEEL_HEIGHT }}
        role="listbox"
        aria-label="Seus servers"
        tabIndex={0}
        {...handlers}
      >
        {/* The lime rail the items ride on: same geometry as the slots, drawn 1:1 in pixels from
          the centre of the column. Decorative — the buttons carry the meaning. */}
        <svg className="wheel-rail" width="0" height="0" aria-hidden>
          <path
            d={RAIL_PATH}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>

        {slots.map((slot, index) => {
          if (!slot.visible) return null;
          const server = index === 0 ? null : servers[index - 1];

          return (
            <button
              key={server?.id ?? "add"}
              type="button"
              className="wheel-item"
              data-add={index === 0}
              data-active={slot.active || server?.id === activeServerId}
              style={{
                translate: `${slot.x}px ${slot.y}px`,
                scale: `${slot.scale}`,
                opacity: slot.opacity,
              }}
              role="option"
              aria-selected={server ? server.id === activeServerId : false}
              title={server?.name ?? "Adicionar server"}
              onClick={() => open(index)}
            >
              {server ? (
                <ServerAvatar server={server} />
              ) : (
                <span aria-hidden>+</span>
              )}
              <span className="sr-only">
                {server?.name ?? "Adicionar server"}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="wheel-lock"
        aria-pressed={locked}
        title={locked ? "Destravar roda" : "Travar roda"}
        onClick={toggleLock}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="5" y="11" width="14" height="10" rx="2" />
          {/* Open lock: the shackle lifts off its right post. */}
          <path
            d={
              locked ? "M8 11V7a4 4 0 0 1 8 0v4" : "M8 11V7a4 4 0 0 1 7.75-1.4"
            }
          />
        </svg>
        <span className="sr-only">
          {locked ? "Destravar roda" : "Travar roda"}
        </span>
      </button>
    </div>
  );
}
