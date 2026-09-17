import type { FormErrorProps } from "../../types/ui.types";

export function FormError({ message }: FormErrorProps) {
  if (!message) return null;
  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  );
}
