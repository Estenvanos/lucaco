/** Run with `node src/lib/utils.check.ts` — fails loudly if the scoring rules drift. */
import assert from "node:assert/strict";
import { listRules, missingPasswordRules, scorePassword } from "./utils.ts";

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

console.log("scorePassword: ok");
