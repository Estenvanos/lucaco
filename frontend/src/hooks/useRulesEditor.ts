import { useState } from "react";
import { LIMITS } from "../constants/limits";
import { ApiError } from "../lib/api";
import { rulesSchema } from "../schemas/rules.schema";
import { useSaveRules } from "../services/rules/rules.api";

/** The draft list lives here until "Salvar"; the parent remounts it (key) when the saved list changes. */
export function useRulesEditor(serverId: string, initial: string[]) {
  const save = useSaveRules(serverId);
  const [rules, setRules] = useState(initial.length ? initial : [""]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const change = (next: string[]) => {
    setRules(next);
    setSaved(false);
  };

  return {
    rules,
    error,
    saved,
    saving: save.isPending,
    canAdd: rules.length < LIMITS.rulesMax,
    edit: (index: number, text: string) => change(rules.map((r, i) => (i === index ? text : r))),
    add: () => change([...rules, ""]),
    remove: (index: number) => change(rules.filter((_, i) => i !== index)),
    /** Swaps with the neighbour above (-1) or below (+1). */
    move: (index: number, step: -1 | 1) => {
      const target = index + step;
      if (target < 0 || target >= rules.length) return;
      const next = [...rules];
      [next[index], next[target]] = [next[target]!, next[index]!];
      change(next);
    },
    submit: () => {
      const parsed = rulesSchema.safeParse(rules);
      if (!parsed.success) return setError(parsed.error.issues[0]!.message);
      setError(null);
      save.mutate(parsed.data, {
        onSuccess: () => setSaved(true),
        onError: (err) => setError(err instanceof ApiError ? err.message : "Não foi possível salvar"),
      });
    },
  };
}
