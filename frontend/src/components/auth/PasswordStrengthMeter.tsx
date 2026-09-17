import type { PasswordStrengthMeterProps } from "../../types/ui.types";

const LABEL = { weak: "Fraca", medium: "Média", strong: "Forte" } as const;

export function PasswordStrengthMeter({ strength, inputId }: PasswordStrengthMeterProps) {
  if (!strength) return null;

  const { score, level, hint } = strength;

  return (
    <div className="strength" id={`${inputId}-strength`} data-level={level}>
      <div className="strength-bars" aria-hidden>
        {[1, 2, 3].map((slot) => (
          <span key={slot} data-on={score >= slot * 2 - 1} />
        ))}
      </div>
      {/* Polite: announced after the person stops typing, not on every keystroke. */}
      <p className="strength-text" aria-live="polite">
        <b>{LABEL[level]}</b>
        {hint && <span> — {hint}</span>}
      </p>
    </div>
  );
}
