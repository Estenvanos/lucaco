import { LIMITS } from "../../constants/limits";
import type { VoiceUserMenuProps } from "../../types/ui.types";

/**
 * Right-click (or card dropdown) menu of a user in the call (stage tile or sidebar row). popover="auto" gives Esc and
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
          max={LIMITS.playbackVolume * 100}
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
