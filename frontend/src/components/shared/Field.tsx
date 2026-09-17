import type { FieldProps } from "../../types/ui.types";

export function Field({ label, name, error, action, ...rest }: FieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-control">
        <input
          {...rest}
          id={rest.id ?? name}
          name={name}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : rest["aria-describedby"]}
        />
        {action}
      </div>
      {error && (
        <small id={`${name}-error`} className="field-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
