import type { FormEvent } from "react";

export type FieldErrors<T> = Partial<Record<keyof T & string, string>>;

export type ZodForm<T> = {
  errors: FieldErrors<T>;
  /** Message from the API (or from a failed submit), already normalized. */
  submitError: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};
