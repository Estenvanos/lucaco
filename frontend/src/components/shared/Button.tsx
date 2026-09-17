import type { ButtonProps } from "../../types/ui.types";
import { cn } from "../../lib/utils";

export function Button({ loading, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button {...rest} className={cn("button", className)} disabled={disabled || loading}>
      {loading ? "..." : children}
    </button>
  );
}
