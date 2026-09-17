import { useState } from "react";
import type { PasswordFieldProps } from "../../types/ui.types";
import { Field } from "./Field";

/** Eye / eye-off drawn inline: two paths are cheaper than an icon dependency. */
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="m4 4 16 16" strokeLinecap="round" />}
    </svg>
  );
}

export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      action={
        <button
          type="button"
          className="field-action"
          onClick={() => setVisible(!visible)}
          aria-pressed={visible}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          // The label is the toggle's job; without this, clicking it also focuses the input.
          onMouseDown={(event) => event.preventDefault()}
        >
          <EyeIcon off={visible} />
        </button>
      }
    />
  );
}
