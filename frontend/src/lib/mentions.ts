export const EVERYONE = "todos";

export type Mentions = { everyone: boolean; userIds: string[] };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `@todos` or `@<name>` not glued to a word on either side; the longest name wins ("Ana Maria" over "Ana"). */
function pattern(names: string[]) {
  const alts = [EVERYONE, ...names].filter(Boolean).sort((a, b) => b.length - a.length).map(escape).join("|");
  return new RegExp(`(?<![\\p{L}\\p{N}_])@(?:${alts})(?![\\p{L}\\p{N}_])`, "giu");
}

/** Splits `text` into plain and `@mention` pieces, for highlighting. */
export function splitMentions(text: string, names: string[]) {
  const parts: { text: string; mention: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(pattern(names))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), mention: false });
    parts.push({ text: m[0], mention: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), mention: false });
  return parts;
}

/** What the API needs to notify: the server cannot read the (encrypted) text. */
export function extractMentions(text: string, members: { userId: string; name: string }[]): Mentions {
  const byName = new Map<string, string[]>();
  for (const { userId, name } of members) {
    const key = name.toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), userId]);
  }
  const userIds = new Set<string>();
  let everyone = false;
  for (const part of splitMentions(text, members.map((m) => m.name))) {
    if (!part.mention) continue;
    const name = part.text.slice(1).toLowerCase();
    if (name === EVERYONE && !byName.has(name)) everyone = true;
    else byName.get(name)?.forEach((id) => userIds.add(id));
  }
  return { everyone, userIds: [...userIds].slice(0, 20) }; // 20: the API's cap
}
