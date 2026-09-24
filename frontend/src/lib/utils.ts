/** Pure helpers only: nothing here imports React. */

import type { ChatMessage, ChatRow } from "../types/messages.types";
import type { PasswordStrength } from "../types/password.types";

export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

export const initials = (name: string) => name.slice(0, 2).toUpperCase();

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/** "18/09/2026, 14:03": next to each message block. */
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** "14:03" today, "Ontem 14:03", "18/09 14:03" this year, "18/09/2025" before: the conversation list. */
export function formatShortDateTime(iso: string) {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return time;
  if (date.toDateString() === yesterday.toDateString()) return `Ontem ${time}`;
  if (date.getFullYear() === today.getFullYear())
    return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${time}`;
  return date.toLocaleDateString("pt-BR");
}

/** One line for the conversation list: the text, or what kind of message it was. */
export function messagePreview(message: ChatMessage | null) {
  if (!message || message.text === null) return "Mensagem cifrada";
  if (message.audio) return "Mensagem de voz";
  if (message.attachment?.kind === "image") return "Imagem";
  if (message.attachment?.kind === "video") return "Vídeo";
  if (message.attachment) return message.attachment.name;
  return message.text;
}

/** Messages closer than this, from the same sender, share one avatar + name header. */
const GROUP_GAP_MS = 5 * 60 * 1000;

/**
 * Newest-first messages (the API and cache order) into oldest-first rows ready to render:
 * `day` marks the first message of each calendar day, `first` the start of each sender block.
 */
export function chatRows(newestFirst: ChatMessage[]): ChatRow[] {
  const rows: ChatRow[] = [];
  for (const message of [...newestFirst].reverse()) {
    const prev = rows.at(-1);
    const date = new Date(message.createdAt);
    const newDay = !prev || new Date(prev.createdAt).toDateString() !== date.toDateString();
    rows.push({
      ...message,
      day: newDay ? date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : null,
      first:
        newDay ||
        prev.senderId !== message.senderId ||
        date.getTime() - new Date(prev.createdAt).getTime() > GROUP_GAP_MS,
    });
  }
  return rows;
}

/** Calls `fn` only once `ms` pass without a new call; the last call's arguments win. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** What a search box sends to the API: trimmed, lowercase, inner runs of spaces collapsed. */
export const normalizeSearch = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

/** Search input handler: normalizes the raw text and hands it to `onSearch` once typing pauses. */
export const debounceSearch = (onSearch: (query: string) => void, ms = 200) =>
  debounce((raw: string) => onSearch(normalizeSearch(raw)), ms);

/**
 * Shortest signed distance from `offset` to slot `index` on a closed ring, in slots.
 * With 8 items, slot 0 is one step after slot 7 — never seven steps back. This is what lets the
 * server wheel turn through 360° instead of stopping at either end.
 */
export function ringDelta(index: number, offset: number, count: number) {
  const half = count / 2;
  return ((((index - offset + half) % count) + count) % count) - half;
}

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

/** 83_000 ms -> "1:23". */
export function formatDuration(ms: number) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Asks before deleting a message, then runs `remove`; a failure is shown to the user.
 * ponytail: native confirm/alert — swap for a Modal if the look matters.
 */
export function confirmDelete(remove: () => Promise<void>) {
  if (!confirm("Excluir esta mensagem para todos? Isso não pode ser desfeito.")) return;
  remove().catch((err: unknown) => alert(err instanceof Error ? err.message : "Não foi possível excluir a mensagem"));
}

export const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
