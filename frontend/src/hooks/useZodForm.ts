import { useState, type FormEvent } from "react";
import type { z } from "zod";
import { ApiError } from "../lib/api";
import type { FieldErrors, ZodForm } from "../types/form.types";

/**
 * Uncontrolled form: the DOM holds the values, so typing re-renders nothing and no effect syncs
 * state. Validation happens on submit, which is where the user asked for an answer.
 */
export function useZodForm<S extends z.ZodType<Record<string, unknown>>>(
  schema: S,
  submit: (values: z.infer<S>) => Promise<unknown>,
): ZodForm<z.infer<S>> {
  const [errors, setErrors] = useState<FieldErrors<z.infer<S>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = schema.safeParse(raw);

    if (!parsed.success) {
      setSubmitError(null);
      // First issue per field wins: a field can fail several checks, and the first one is the
      // one to fix ("mínimo 8 caracteres" before "senha fraca demais").
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        fieldErrors[field] ??= issue.message;
      }
      setErrors(fieldErrors as FieldErrors<z.infer<S>>);
      return;
    }

    setErrors({});
    setSubmitError(null);
    submit(parsed.data).catch((err: unknown) =>
      setSubmitError(err instanceof ApiError ? err.message : "Não foi possível completar a ação"),
    );
  };

  return { errors, submitError, onSubmit };
}
