/** Pure helpers only: nothing here imports React. */

import type { PasswordStrength } from "../types/password.types";

export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

export const initials = (name: string) => name.slice(0, 2).toUpperCase();

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/* ---------- password strength ---------- */

// Cheap denylist of what people actually type here. ponytail: a real breach list (zxcvbn, HIBP)
// belongs server side at sign-up if abuse shows up; this only drives the meter.
const COMMON = ["password", "senha", "qwerty", "admin", "lucaco", "123456", "abcdef", "iloveyou"];

/** Hard requirements: every new password has to satisfy all three. */
const RULES = [
  { test: /[A-Z]/, label: "uma letra maiúscula" },
  { test: /\d/, label: "um número" },
  { test: /[^A-Za-z0-9]/, label: "um caractere especial" },
] as const;

/** The rules the password still breaks, in reading order. Empty means it passes. */
export const missingPasswordRules = (password: string) =>
  RULES.filter((rule) => !rule.test.test(password)).map((rule) => rule.label);

/** "um número e um caractere especial" — for a message the person can act on. */
export const listRules = (labels: readonly string[]) =>
  labels.length < 2 ? (labels[0] ?? "") : `${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}`;

const SEQUENCES = "abcdefghijklmnopqrstuvwxyz0123456789qwertyuiopasdfghjklzxcvbnm";

/** True when the password contains 4+ characters that run in order on a keyboard or alphabet. */
function hasRun(lower: string) {
  for (let i = 0; i + 4 <= lower.length; i++) {
    const chunk = lower.slice(i, i + 4);
    const reversed = [...chunk].reverse().join("");
    if (SEQUENCES.includes(chunk) || SEQUENCES.includes(reversed)) return true;
  }
  return false;
}

/**
 * Scores length and character variety, then subtracts for the patterns that make a long password
 * guessable anyway (a common word, a repeat, a keyboard run).
 */
export function scorePassword(password: string): PasswordStrength {
  const lower = password.toLowerCase();
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (classes >= 2) score += 1;
  if (classes >= 3) score += 1;
  if (classes === 4) score += 1;

  if (/(.)\1{2,}/.test(password)) score -= 1;
  if (hasRun(lower)) score -= 1;
  // A password built around a common word is guessable no matter how it is decorated.
  if (COMMON.some((word) => lower.includes(word))) score = Math.min(score, 1);

  score = Math.max(0, Math.min(5, score));

  const missing = missingPasswordRules(password);
  const hint =
    password.length < 8
      ? "Use pelo menos 8 caracteres"
      : missing.length > 0
        ? `Falta ${listRules(missing)}`
        : COMMON.some((word) => lower.includes(word))
          ? "Evite palavras óbvias como “senha” ou “123456”"
          : password.length < 12
            ? "Senhas de 12+ caracteres são bem mais difíceis de quebrar"
            : null;

  return { score, level: score <= 2 ? "weak" : score <= 4 ? "medium" : "strong", hint };
}
