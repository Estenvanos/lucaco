/** Run with `node src/lib/utils.check.ts` — fails loudly if the scoring rules drift. */
import assert from "node:assert/strict";
import {
  chatRows,
  debounceSearch,
  listRules,
  missingPasswordRules,
  normalizeSearch,
  ringDelta,
  scorePassword,
} from "./utils.ts";
import { extractMentions, splitMentions } from "./mentions.ts";

const level = (password: string) => scorePassword(password).level;

assert.equal(level(""), "weak");
assert.equal(level("curta1"), "weak", "under 8 characters is always weak");
assert.equal(level("senha12345"), "weak", "a common word caps the score");
assert.equal(level("Senha@2026"), "weak", "decorating a common word does not save it");
assert.equal(level("abcdefghijkl"), "weak", "long but one class and a keyboard run");
assert.equal(level("aaaaaaaa1A"), "weak", "a triple repeat costs a point");
assert.equal(level("Trilho8Verde"), "medium");
assert.equal(level("Trilho-8-Verde-Norte"), "strong");
assert.equal(scorePassword("Trilho-8-Verde-Norte").hint, null, "nothing left to suggest");
assert.match(scorePassword("Trilho8Verde").hint ?? "", /caractere especial/, "names the missing rule");

assert.deepEqual(missingPasswordRules("Trilho-8"), [], "upper + digit + symbol passes");
assert.deepEqual(missingPasswordRules("trilhoverde"), [
  "uma letra maiúscula",
  "um número",
  "um caractere especial",
]);
assert.equal(listRules(["um número"]), "um número");
assert.equal(listRules(["uma letra maiúscula", "um número"]), "uma letra maiúscula e um número");
assert.equal(
  listRules(["uma letra maiúscula", "um número", "um caractere especial"]),
  "uma letra maiúscula, um número e um caractere especial",
);
assert.match(scorePassword("curta1").hint ?? "", /8 caracteres/);

assert.equal(ringDelta(3, 3, 8), 0, "the centred slot is at distance zero");
assert.equal(ringDelta(4, 3, 8), 1);
assert.equal(ringDelta(2, 3, 8), -1);
assert.equal(ringDelta(0, 7, 8), 1, "wraps forward past the last slot");
assert.equal(ringDelta(7, 0, 8), -1, "wraps backward past the first slot");
assert.equal(ringDelta(0, 0.5, 8), -0.5, "a mid-drag offset keeps its fraction");
assert.equal(ringDelta(0, 0, 1), 0, "a wheel holding only the add button never moves");
assert.ok(Math.abs(ringDelta(4, 0, 8)) === 4, "the far side is half a ring away, either way");

console.log("scorePassword + ringDelta: ok");

assert.equal(normalizeSearch("  Pixel   CLUB \n"), "pixel club", "trims, lowercases, collapses spaces");
assert.equal(normalizeSearch("   "), "", "blank stays blank");

const sent: string[] = [];
const search = debounceSearch((query) => sent.push(query), 20);
search("P");
search("Pi");
search("  PIXEL ");
await new Promise((resolve) => setTimeout(resolve, 40));
assert.deepEqual(sent, ["pixel"], "only the last keystroke reaches the API, normalized");

const msg = (id: string, senderId: string, createdAt: string) => ({ id, senderId, text: id, createdAt });
const rows = chatRows([
  msg("d", "bob", "2026-09-19T10:00:00Z"),
  msg("c", "bob", "2026-09-18T12:10:00Z"),
  msg("b", "alice", "2026-09-18T12:01:00Z"),
  msg("a", "alice", "2026-09-18T12:00:00Z"),
]);
assert.deepEqual(rows.map((r) => r.id), ["a", "b", "c", "d"], "oldest first on screen");
assert.deepEqual(rows.map((r) => r.first), [true, false, true, true], "same sender within 5 min shares a header");
assert.ok(rows[0].day && !rows[1].day && !rows[2].day && rows[3].day, "a divider on each new day only");
console.log("chatRows: ok");

const people = [
  { userId: "1", name: "Ana" },
  { userId: "2", name: "Ana Maria" },
  { userId: "3", name: "Bob" },
];
assert.deepEqual(extractMentions("oi @todos", people), { everyone: true, userIds: [] });
assert.deepEqual(extractMentions("@Ana Maria e @bob!", people), { everyone: false, userIds: ["2", "3"] }, "longest name, any case");
assert.deepEqual(extractMentions("mail a@bob.com, @Anabel", people), { everyone: false, userIds: [] }, "not glued to words");
assert.deepEqual(
  splitMentions("oi @Bob, tudo?", ["Bob"]).map((p) => [p.text, p.mention]),
  [["oi ", false], ["@Bob", true], [", tudo?", false]],
);
console.log("mentions: ok");
