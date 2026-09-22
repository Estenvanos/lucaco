import { useSyncExternalStore } from "react";
import { ApiError } from "../../lib/api";
import type { KeyPrompt, KeyPromptKind } from "../../types/messages.types";

// The E2E layer runs outside React, but asking for the recovery password needs a dialog. This is
// the bridge: askPassword() publishes a prompt and waits, the dialog (RootLayout) answers it.
let prompt: KeyPrompt | null = null;
const listeners = new Set<() => void>();

function show(next: KeyPrompt | null) {
  prompt = next;
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export const useKeyPrompt = () => useSyncExternalStore(subscribe, () => prompt);

/**
 * Shows the dialog until the user answers. `unlock` runs with the typed password; throwing keeps
 * the dialog open with the error, returning settles with that value. Skip settles null; dismiss
 * rejects, so the caller fails this time and asks again on its next try.
 */
export function askPassword<T>(kind: KeyPromptKind, unlock: (password: string) => Promise<T>) {
  return new Promise<T | null>((resolve, reject) =>
    show({
      kind,
      submit: async (password) => {
        resolve(await unlock(password));
        show(null);
      },
      skip: () => {
        resolve(null);
        show(null);
      },
      dismiss: () => {
        reject(new ApiError(403, "Mensagens bloqueadas: informe a senha de recuperação."));
        show(null);
      },
    }),
  );
}
