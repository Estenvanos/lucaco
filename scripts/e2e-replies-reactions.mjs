/**
 * End-to-end check of replies, reactions and their notifications against the real stack
 * (API + Postgres + Mongo), through HTTP and the socket like the browser does. The ciphertext is
 * fake: the server never reads it, so it only has to be base64.
 *
 * Usage: npm run services && npm run dev, then  npm run e2e:replies
 * Reruns reuse the same three accounts (sign-up is limited to 5 per hour per IP).
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

// socket.io-client is a frontend dependency; borrow it instead of adding one to the root.
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { io } = await import(require.resolve("socket.io-client"));

const API = process.env.API_URL ?? "http://localhost:3333";
const PASSWORD = "Trilho-8-Verde";
const SERVER_NAME = "E2E respostas";

async function api(path, { token, body, cookie, method = body ? "POST" : "GET" } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : null),
      ...(token ? { Authorization: `Bearer ${token}` } : null),
      ...(cookie ? { Cookie: cookie } : null),
    },
    body: body && JSON.stringify(body),
  });
  const data = res.status === 204 ? {} : await res.json();
  if (!res.ok) throw Object.assign(new Error(`${method} ${path} -> ${res.status} ${data.error ?? ""}`), { status: res.status });
  // The rotated refresh cookie, kept for the next run.
  const refresh = res.headers.getSetCookie().find((c) => c.startsWith("refresh_token="));
  return refresh ? { ...data, cookie: refresh.split(";")[0] } : data;
}

/**
 * Refresh cookies from earlier runs, like a browser keeps them. Sign-in is limited to 5 per login
 * every 15 minutes, so reruns refresh instead and only sign in when that fails.
 */
const COOKIES = join(tmpdir(), "lucaco-e2e-sessions.json");
const cookies = await readFile(COOKIES, "utf8").then(JSON.parse, () => ({}));

/** Signs up once, then refreshes (or signs in) on later runs; connects a socket. */
async function account(username) {
  const user = { username, email: `${username}@lucaco.test`, password: PASSWORD };
  const session = await api("/auth/refresh", { body: {}, cookie: cookies[username] })
    .catch(() => api("/auth/sign-up", { body: user }))
    .catch(() => api("/auth/sign-in", { body: { login: username, password: PASSWORD } }));
  cookies[username] = session.cookie;
  const token = session.accessToken;
  const me = await api("/users/me", { token });
  const socket = io(API, { auth: { token }, transports: ["websocket"] });
  await new Promise((resolve, reject) => socket.once("connect", resolve).once("connect_error", reject));
  return { id: me.id, username, token, socket };
}

/**
 * Emits with ack; an `{ error }` ack becomes a rejection, like the frontend does. The socket rate
 * limit (a rerun right after another) is waited out instead of failing the test.
 */
async function emit(who, event, payload) {
  const ack = await who.socket.timeout(5000).emitWithAck(event, payload);
  const wait = /try again in (\d+)s/.exec(ack?.error ?? "");
  if (wait) {
    await new Promise((resolve) => setTimeout(resolve, Number(wait[1]) * 1000 + 200));
    return emit(who, event, payload);
  }
  if (ack && "error" in ack) throw new Error(String(ack.error));
  return ack;
}

/** Resolves with the next `event` payload that matches, or fails after 3 s. */
const next = (who, event, match = () => true) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${event} for ${who.username}`)), 3000);
    const on = (payload) => {
      if (!match(payload)) return;
      clearTimeout(timer);
      who.socket.off(event, on);
      resolve(payload);
    };
    who.socket.on(event, on);
  });

const sealed = () => ({
  clientMessageId: randomUUID(),
  ciphertext: randomBytes(24).toString("base64"),
  iv: randomBytes(12).toString("base64"),
});

const notifications = (who) => api("/notifications", { token: who.token });
const noticeFrom = async (who, from, tag) => (await notifications(who)).filter((n) => n.owner.id === from.id && n.tag === tag);

let alice, bob, carol;

before(async () => {
  [alice, bob, carol] = await Promise.all(["e2e_alice", "e2e_bob", "e2e_carol"].map(account));
  await writeFile(COOKIES, JSON.stringify(cookies));
  // alice <-> bob are friends; carol is a stranger to both.
  await api("/friends", { token: alice.token, body: { username: bob.username } }).catch((err) => {
    if (err.status !== 409) throw err;
  });
  await api(`/friends/${alice.id}/accept`, { token: bob.token, body: {} }).catch((err) => {
    if (err.status !== 409 && err.status !== 404) throw err;
  });
  // Start from an empty inbox so counts below mean something.
  await api("/messages/read", { token: alice.token, body: { peerId: bob.id } });
  await api("/messages/read", { token: bob.token, body: { peerId: alice.id } });
});

after(() => [alice, bob, carol].forEach((who) => who?.socket.close()));

describe("DM", () => {
  let original;

  it("sends a message with no reply and no reactions", async () => {
    original = await emit(alice, "message:send", { peerId: bob.id, ...sealed() });
    assert.equal(original.answerFor, null);
    assert.deepEqual(original.reactions, []);
  });

  it("stores and relays a reply, and notifies the replied author", async () => {
    const relayed = next(alice, "message:new", (m) => m.senderId === bob.id);
    const reply = await emit(bob, "message:send", { peerId: alice.id, answerFor: original.id, ...sealed() });
    assert.equal(reply.answerFor, original.id);
    assert.equal((await relayed).answerFor, original.id);

    const [notice] = await noticeFrom(alice, bob, "reply");
    assert.equal(notice?.subtitle, "respondeu sua mensagem");
  });

  it("keeps the reply in the history", async () => {
    const page = await api(`/messages?peerId=${bob.id}`, { token: alice.token });
    assert.equal(page.messages[0].answerFor, original.id);
  });

  it("rejects a reply to a message that is not in this conversation", async () => {
    await assert.rejects(
      emit(alice, "message:send", { peerId: bob.id, answerFor: "0".repeat(24), ...sealed() }),
      /Invalid reply/,
    );
  });

  it("adds a reaction, relays it to both sides and notifies the author", async () => {
    const relayed = next(alice, "message:reacted", (e) => e.id === original.id);
    const ack = await emit(bob, "message:react", { messageId: original.id, emoji: "👍", peerId: alice.id });
    assert.deepEqual(ack.reactions, [{ emoji: "👍", userId: bob.id }]);
    assert.deepEqual((await relayed).reactions, ack.reactions);

    const [notice] = await noticeFrom(alice, bob, "reaction");
    assert.equal(notice?.subtitle, "reagiu com 👍 à sua mensagem");
  });

  it("keeps one reaction per person: another emoji replaces it", async () => {
    await emit(alice, "message:react", { messageId: original.id, emoji: "😂", peerId: bob.id });
    const ack = await emit(bob, "message:react", { messageId: original.id, emoji: "🔥", peerId: alice.id });
    assert.deepEqual(
      [...ack.reactions].sort((a, b) => a.userId.localeCompare(b.userId)),
      [
        { emoji: "😂", userId: alice.id },
        { emoji: "🔥", userId: bob.id },
      ].sort((a, b) => a.userId.localeCompare(b.userId)),
    );
  });

  it("removes a reaction when the same emoji is sent again, without notifying", async () => {
    const before = (await noticeFrom(alice, bob, "reaction")).length;
    const ack = await emit(bob, "message:react", { messageId: original.id, emoji: "🔥", peerId: alice.id });
    assert.deepEqual(ack.reactions, [{ emoji: "😂", userId: alice.id }]);
    assert.equal((await noticeFrom(alice, bob, "reaction")).length, before);
  });

  it("does not notify someone reacting to their own message", async () => {
    // alice's 😂 above is on her own message.
    assert.equal((await noticeFrom(alice, alice, "reaction")).length, 0);
  });

  it("rejects text that is not a single emoji", async () => {
    await assert.rejects(emit(bob, "message:react", { messageId: original.id, emoji: "oi", peerId: alice.id }), /Validation failed/);
    await assert.rejects(emit(bob, "message:react", { messageId: original.id, emoji: "👍👍", peerId: alice.id }), /Validation failed/);
  });

  it("does not let a stranger react to the DM", async () => {
    await assert.rejects(
      emit(carol, "message:react", { messageId: original.id, emoji: "👍", peerId: alice.id }),
      /Wrong conversation/,
    );
  });

  it("404s a reaction on a deleted message", async () => {
    const gone = await emit(alice, "message:send", { peerId: bob.id, ...sealed() });
    await emit(alice, "message:delete", { messageId: gone.id, peerId: bob.id });
    await assert.rejects(emit(bob, "message:react", { messageId: gone.id, emoji: "👍", peerId: alice.id }), /not found/);
  });

  it("clears reply and reaction notices when the chat is opened", async () => {
    await api("/messages/read", { token: alice.token, body: { peerId: bob.id } });
    assert.equal((await noticeFrom(alice, bob, "reply")).length, 0);
    assert.equal((await noticeFrom(alice, bob, "reaction")).length, 0);
  });
});

describe("server channel", () => {
  let server, channel, original;

  before(async () => {
    const mine = await api("/servers", { token: alice.token });
    server = mine.find((s) => s.name === SERVER_NAME) ?? (await api("/servers", { token: alice.token, body: { name: SERVER_NAME, visibility: "public" } }));
    await api(`/servers/${server.id}/members`, { token: bob.token, body: {} }).catch((err) => {
      if (err.status !== 409) throw err;
    });
    channel = (await api(`/servers/${server.id}/channels`, { token: alice.token })).find((c) => c.type === "text");

    // A channel message names a key epoch; start one if the channel has none yet. The wrapped
    // key is opaque to the API, so random bytes stand in for it.
    const keys = await api(`/messages/channels/${channel.id}/keys`, { token: alice.token });
    if (keys.latest === 0) {
      await api("/users/me/keys", { method: "PUT", token: alice.token, body: { publicKey: randomBytes(91).toString("base64") } }).catch(() => {});
      await api(`/messages/channels/${channel.id}/keys`, {
        token: alice.token,
        body: { epoch: 1, shares: [{ recipientId: alice.id, encryptedKey: randomBytes(48).toString("base64"), iv: randomBytes(12).toString("base64") }] },
      });
    }
    channel.epoch = (await api(`/messages/channels/${channel.id}/keys`, { token: alice.token })).latest;
  });

  it("replies in a channel and notifies the author with where it happened", async () => {
    original = await emit(alice, "message:send", { channelId: channel.id, keyEpoch: channel.epoch, ...sealed() });
    const reply = await emit(bob, "message:send", {
      channelId: channel.id,
      keyEpoch: channel.epoch,
      answerFor: original.id,
      ...sealed(),
    });
    assert.equal(reply.answerFor, original.id);

    const notice = (await noticeFrom(alice, bob, "reply")).find((n) => n.channelId === channel.id);
    assert.equal(notice?.serverId, server.id);
    assert.match(notice.subtitle, /respondeu sua mensagem em #/);
  });

  it("lets a member react and notifies the author with where it happened", async () => {
    const ack = await emit(bob, "message:react", { messageId: original.id, emoji: "🎉" });
    assert.deepEqual(ack.reactions, [{ emoji: "🎉", userId: bob.id }]);

    const notice = (await noticeFrom(alice, bob, "reaction")).find((n) => n.channelId === channel.id);
    assert.match(notice?.subtitle ?? "", /reagiu com 🎉 à sua mensagem em #/);
  });

  it("does not let a non-member react", async () => {
    await assert.rejects(emit(carol, "message:react", { messageId: original.id, emoji: "👍" }));
  });

  it("lets only the author or a moderator delete: a member cannot delete the owner's message", async () => {
    await assert.rejects(emit(bob, "message:delete", { messageId: original.id }));
    await emit(alice, "message:delete", { messageId: original.id });
  });
});
