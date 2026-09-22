import { useState } from "react";
import type { z } from "zod";
import { recoveryPasswordSchema, unlockKeysSchema } from "../schemas/users.schema";
import type { KeyPrompt } from "../types/messages.types";
import { useZodForm } from "./useZodForm";

/** Answers the E2E layer's recovery-password prompt: unlock the backup, or create one. */
export function useKeyPasswordForm(prompt: KeyPrompt) {
  const [loading, setLoading] = useState(false);
  // Restore only asks for the password; creating also confirms it.
  const schema: z.ZodType<{ password: string; confirmPassword?: string }> =
    prompt.kind === "restore" ? unlockKeysSchema : recoveryPasswordSchema;

  const form = useZodForm(schema, async ({ password }) => {
    setLoading(true);
    try {
      await prompt.submit(password);
    } finally {
      setLoading(false);
    }
  });

  return { ...form, loading };
}
