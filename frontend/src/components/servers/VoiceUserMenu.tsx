import type { MouseEvent } from "react";
import type { VoiceUserMenuProps } from "../../types/ui.types";

/**
 * Opens the menu nested in the right-clicked element at the cursor; from the keyboard (Shift+F10)
 * the event has no position, so it opens over the element.
 */
export function openVoiceUserMenu(event: MouseEvent<HTMLElement>) {
  const menu = event.currentTarget.querySelector<HTMLElement>("[popover]");
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

/**
 * Right-click menu of a user in the call (stage tile or sidebar row). popover="auto" gives Esc and
 * click-outside for free. Changes only affect what this tab plays.
 */
export function VoiceUserMenu({ name, audio, onVolume, onMute }: VoiceUserMenuProps) {
  return (
    <div popover="auto" className="voice-user-menu" onContextMenu={(event) => event.preventDefault()}>
      <p className="voice-user-menu-name">{name}</p>
      <label className="voice-user-menu-volume">
        <span>
          Volume do usuário <output>{Math.round(audio.volume * 100)}%</output>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(audio.volume * 100)}
          onChange={(event) => onVolume(event.currentTarget.valueAsNumber / 100)}
        />
      </label>
      <label className="voice-user-menu-mute">
        <input type="checkbox" checked={audio.muted} onChange={onMute} />
        Silenciar
      </label>
    </div>
  );
}
