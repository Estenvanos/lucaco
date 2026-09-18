import { jest } from "@jest/globals";
import { MongoServerError, ObjectId } from "mongodb";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();

const messages = { insertOne: mock(), findOne: mock(), find: mock(), aggregate: mock() };
const areFriends = mock();
const list = mock();
const canonicalPair = (a: string, b: string) =>
  a < b ? { userLowId: a, userHighId: b } : { userLowId: b, userHighId: a };

jest.unstable_mockModule("../../lib/mongo.js", () => ({ messages }));
jest.unstable_mockModule("../friends/friends.services.js", () => ({ areFriends, canonicalPair, list }));
const notifications = { notifyOnce: mock(), dismissFrom: mock() };
jest.unstable_mockModule("../notifications/notifications.services.js", () => notifications);
jest.unstable_mockModule("../users/users.services.js", () => ({
  getById: jest.fn(async (id: string) => ({ id, username: "alice", displayName: null })),
}));

const service = await import("./messages.services.js");

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";
const CAROL = "33333333-3333-3333-3333-333333333333";

const input = {
  peerId: BOB,
  ciphertext: "Y2lwaGVy",
  iv: "aXZpdml2aXY=",
  clientMessageId: "44444444-4444-4444-4444-444444444444",
  contentType: "text" as const,
};

const doc = (over: Record<string, unknown> = {}) => ({
  _id: new ObjectId(),
  channelId: service.dmId(ALICE, BOB),
  scope: "dm",
  senderId: ALICE,
  clientMessageId: input.clientMessageId,
  contentType: "text",
  ciphertext: input.ciphertext,
  iv: input.iv,
  keyEpoch: null,
  createdAt: new Date(),
  expiresAt: null,
  ...over,
});

/** find().sort().limit().toArray() as a chain of mocks. */
const findReturns = (rows: unknown[]) => {
  const chain = { sort: mock(), limit: mock(), toArray: mock() };
  chain.sort.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.toArray.mockResolvedValue(rows);
  messages.find.mockReturnValue(chain);
  return chain;
};

const duplicateKey = () => {
  const err = new MongoServerError({ message: "duplicate key" });
  err.code = 11000;
  return err;
};

beforeEach(() => {
  areFriends.mockResolvedValue(true);
});

describe("dmId", () => {
  it("is the same conversation seen from either side", () => {
    expect(service.dmId(ALICE, BOB)).toBe(service.dmId(BOB, ALICE));
  });

  it("is a different conversation for a different pair", () => {
    expect(service.dmId(ALICE, BOB)).not.toBe(service.dmId(ALICE, CAROL));
  });

  it("is a valid v5 uuid, so it fits the channel_id columns", () => {
    expect(service.dmId(ALICE, BOB)).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-5[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
    );
  });
});

describe("send", () => {
  it("stores the ciphertext untouched and never a plaintext field", async () => {
    messages.insertOne.mockResolvedValue({});

    const message = await service.send(ALICE, input);

    const stored = messages.insertOne.mock.calls[0]![0];
    expect(stored).toMatchObject({
      channelId: service.dmId(ALICE, BOB),
      scope: "dm",
      senderId: ALICE,
      ciphertext: input.ciphertext,
      iv: input.iv,
      keyEpoch: null,
    });
    expect(Object.keys(stored)).not.toContain("content");
    expect(message.id).toBe(stored._id.toHexString());
  });

  it("leaves the receiver one unread-message notice from the sender", async () => {
    messages.insertOne.mockResolvedValue({});
    areFriends.mockResolvedValue(true);

    await service.send(ALICE, input);

    expect(notifications.notifyOnce).toHaveBeenCalledWith({
      tag: "new_message",
      title: "alice te mandou uma mensagem",
      ownerId: ALICE,
      receiverId: BOB,
    });
  });

  it("refuses to message someone who is not an accepted friend", async () => {
    areFriends.mockResolvedValue(false);

    await expect(service.send(ALICE, input)).rejects.toMatchObject({ status: 403 });
    expect(messages.insertOne).not.toHaveBeenCalled();
  });

  it("returns the stored message when the same clientMessageId is retried", async () => {
    const existing = doc();
    messages.insertOne.mockRejectedValue(duplicateKey());
    messages.findOne.mockResolvedValue(existing);

    const message = await service.send(ALICE, input);

    expect(message.id).toBe(existing._id.toHexString());
    expect(messages.findOne).toHaveBeenCalledWith({
      senderId: ALICE,
      clientMessageId: input.clientMessageId,
    });
  });

  it("rethrows a write error that is not the idempotency conflict", async () => {
    messages.insertOne.mockRejectedValue(new Error("mongo down"));

    await expect(service.send(ALICE, input)).rejects.toThrow("mongo down");
  });
});

describe("history", () => {
  it("refuses a conversation the user is not part of", async () => {
    areFriends.mockResolvedValue(false);

    await expect(service.history(ALICE, { peerId: BOB, limit: 30 })).rejects.toMatchObject({
      status: 403,
    });
    expect(messages.find).not.toHaveBeenCalled();
  });

  it("reads the pair's conversation newest first, one row over the page", async () => {
    const chain = findReturns([doc(), doc()]);

    const page = await service.history(ALICE, { peerId: BOB, limit: 30 });

    expect(messages.find).toHaveBeenCalledWith({ channelId: service.dmId(ALICE, BOB) });
    expect(chain.sort).toHaveBeenCalledWith({ _id: -1 });
    expect(chain.limit).toHaveBeenCalledWith(31);
    expect(page).toMatchObject({ hasMore: false, nextCursor: null });
    expect(page.messages).toHaveLength(2);
  });

  it("reports hasMore and the cursor of the last returned message", async () => {
    const rows = [doc(), doc(), doc()];
    findReturns(rows);

    const page = await service.history(ALICE, { peerId: BOB, limit: 2 });

    expect(page.messages).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(rows[1]!._id.toHexString());
  });

  it("walks backwards from the cursor", async () => {
    const cursor = new ObjectId().toHexString();
    findReturns([]);

    await service.history(ALICE, { peerId: BOB, before: cursor, limit: 30 });

    expect(messages.find).toHaveBeenCalledWith({
      channelId: service.dmId(ALICE, BOB),
      _id: { $lt: new ObjectId(cursor) },
    });
  });
});

describe("conversations", () => {
  const bob = { id: BOB, username: "bob", displayName: null, avatarUrl: null };

  it("lists friends with messages, newest first, looking only at the user's DM channels", async () => {
    list.mockResolvedValue([{ userId: BOB, user: bob }]);
    const lastMessageAt = new Date();
    messages.aggregate.mockReturnValue({
      toArray: mock().mockResolvedValue([{ _id: service.dmId(ALICE, BOB), lastMessageAt }]),
    });

    const result = await service.conversations(ALICE);

    expect(list).toHaveBeenCalledWith(ALICE, { status: "accepted" });
    const [match] = messages.aggregate.mock.calls[0]![0] as [{ $match: unknown }];
    expect(match).toEqual({ $match: { channelId: { $in: [service.dmId(ALICE, BOB)] } } });
    expect(result).toEqual([{ peer: bob, lastMessageAt }]);
  });
});

describe("markRead", () => {
  it("clears only the peer's unread-message notices, for the reader", async () => {
    await service.markRead(ALICE, BOB);
    expect(notifications.dismissFrom).toHaveBeenCalledWith(ALICE, BOB, "new_message");
  });
});

describe("typing", () => {
  it("is refused between users who are not friends", async () => {
    areFriends.mockResolvedValue(false);
    await expect(service.typing(ALICE, CAROL)).rejects.toMatchObject({ status: 403 });
  });
});
