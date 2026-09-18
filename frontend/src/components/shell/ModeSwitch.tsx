import type { ModeSwitchProps } from "../../types/ui.types";

/** Flips the wheel between servers and friends; checked = friends. */
export function ModeSwitch({ mode, onToggle }: ModeSwitchProps) {
  const friends = mode === "friends";
  const label = friends ? "Mostrando amigos" : "Mostrando servers";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={friends}
      className="mode-switch"
      title={friends ? "Ver servers" : "Ver amigos"}
      onClick={onToggle}
    >
      <svg className="mode-switch-servers" width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="4" y="4" width="7" height="7" rx="2" />
        <rect x="13" y="4" width="7" height="7" rx="2" />
        <rect x="4" y="13" width="7" height="7" rx="2" />
        <rect x="13" y="13" width="7" height="7" rx="2" />
      </svg>
      <svg className="mode-switch-friends" width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" />
      </svg>
      <span className="sr-only">{label}</span>
    </button>
  );
}
