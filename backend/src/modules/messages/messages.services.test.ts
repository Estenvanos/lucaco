import { jest } from "@jest/globals";
import { MongoServerError, ObjectId } from "mongodb";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();

const messages = {
  insertOne: mock(),
  findOne: mock(),
  find: mock(),
  aggregate: mock(),
  deleteOne: mock(),
  findOneAndUpdate: mock(),
};
const areFriends = mock();
const list = mock();
const canonicalPair = (a: string, b: string) =>
  a < b ? { userLowId: a, userHighId: b } : { userLowId: b, userHighId: a };

jest.unstable_mockModule("../../lib/mongo.js", () => ({ messages }));
jest.unstable_mockModule("../friends/friends.services.js", () => ({ areFriends, canonicalPair, list }));
const notifications = { notifyOnce: mock(), notify: mock(), dismissFrom: mock() };
jest.unstable_mockModule("../notifications/notifications.services.js", () => notifications);
const getActiveKey = mock();
const getActiveKeys = mock();
jest.unstable_mockModule("../users/users.services.js", () => ({
  getById: jest.fn(async (id: string) => ({ id, username: "alice", displayName: null })),
  getActiveKey,
  getActiveKeys,
}));
const channelsService = {
  canView: mock(),
  canSend: mock(),
  canSendVoice: mock(),
  canAttach: mock(),
  canManageMessages: mock(),
  viewerIds: mock(),
  getById: mock(),
};
jest.unstable_mockModule("../channels/channels.services.js", () => channelsService);
const channelKeyEpoch = { findFirst: mock(), create: mock() };
const channelKeyShare = { findMany: mock(), findUnique: mock(), createMany: mock() };
const mediaFile = { findUnique: mock(), deleteMany: mock() };
jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma: { channelKeyEpoch, channelKeyShare, mediaFile } }));
const deleteObject = mock();
jest.unstable_mockModule("../../lib/storage.js", () => ({ deleteObject }));

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
  jest.clearAllMocks();
  areFriends.mockResolvedValue(true);
  channelsService.canView.mockResolvedValue({});
  channelsService.canSend.mockResolvedValue({});
  channelsService.canSendVoice.mockResolvedValue({});
  channelsService.canAttach.mockResolvedValue({});
  channelsService.canManageMessages.mockResolvedValue({});
  messages.findOne.mockReset();
  channelsService.viewerIds.mockResolvedValue([ALICE, BOB]);
  getActiveKey.mockResolvedValue({ publicKey: "YWxpY2U=" });
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

  it("lists friends with messages, newest first, with the last message still encrypted", async () => {
    list.mockResolvedValue([{ userId: BOB, user: bob }]);
    const lastMessageAt = new Date();
    const last = {
      _id: new ObjectId(),
      channelId: service.dmId(ALICE, BOB),
      scope: "dm",
      senderId: BOB,
      clientMessageId: "c1",
      contentType: "text",
      ciphertext: "opaque",
      iv: "iv",
      keyEpoch: null,
      createdAt: lastMessageAt,
      expiresAt: null,
    };
    messages.aggregate.mockReturnValue({
      toArray: mock().mockResolvedValue([{ _id: service.dmId(ALICE, BOB), last }]),
    });

    const result = await service.conversations(ALICE);

    expect(list).toHaveBeenCalledWith(ALICE, { status: "accepted" });
    const [match] = messages.aggregate.mock.calls[0]![0] as [{ $match: unknown }];
    expect(match).toEqual({ $match: { channelId: { $in: [service.dmId(ALICE, BOB)] } } });
    expect(result).toEqual([
      { peer: bob, lastMessageAt, lastMessage: expect.objectContaining({ senderId: BOB, ciphertext: "opaque" }) },
    ]);
  });
});

describe("markRead", () => {
  it("clears the peer's unread-message, reply and reaction notices, for the reader", async () => {
    await service.markRead(ALICE, BOB);
    expect(notifications.dismissFrom.mock.calls).toEqual([
      [ALICE, BOB, "new_message"],
      [ALICE, BOB, "reply"],
      [ALICE, BOB, "reaction"],
    ]);
  });
});

describe("typing", () => {
  it("is refused between users who are not friends", async () => {
    areFriends.mockResolvedValue(false);
    await expect(service.typing(ALICE, CAROL)).rejects.toMatchObject({ status: 403 });
  });
});

describe("messages in a server channel", () => {
  const CHANNEL = "55555555-5555-5555-5555-555555555555";
  const channelInput = {
    ...input,
    peerId: undefined,
    channelId: CHANNEL,
    keyEpoch: 2,
    mentions: { everyone: false, userIds: [] as string[] },
  };

  describe("mentions", () => {
    beforeEach(() => {
      channelKeyEpoch.findFirst.mockResolvedValue({ id: "e2", epoch: 2 });
      messages.insertOne.mockResolvedValue({});
      channelsService.viewerIds.mockResolvedValue([ALICE, BOB, CAROL]);
      channelsService.getById.mockResolvedValue({ id: CHANNEL, serverId: "srv", name: "geral" });
    });

    it("@todos pings every viewer except the sender", async () => {
      await service.sendToChannel(ALICE, { ...channelInput, mentions: { everyone: true, userIds: [] } });
      expect(notifications.notify.mock.calls.map(([n]) => n.receiverId).sort()).toEqual([BOB, CAROL]);
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ tag: "mention", serverId: "srv", channelId: CHANNEL }),
      );
    });

    it("ignores ids that cannot view the channel, and the sender", async () => {
      const outsider = "99999999-9999-9999-9999-999999999999";
      await service.sendToChannel(ALICE, { ...channelInput, mentions: { everyone: false, userIds: [BOB, outsider, ALICE] } });
      expect(notifications.notify.mock.calls.map(([n]) => n.receiverId)).toEqual([BOB]);
    });

    it("does not ping again on a retry", async () => {
      messages.insertOne.mockRejectedValue(duplicateKey());
      messages.findOne.mockResolvedValue(doc({ scope: "channel", channelId: CHANNEL, keyEpoch: 2 }));
      await service.sendToChannel(ALICE, { ...channelInput, mentions: { everyone: true, userIds: [] } });
      expect(notifications.notify).not.toHaveBeenCalled();
    });
  });

  it("stores the epoch with the ciphertext and pushes only to current viewers", async () => {
    channelKeyEpoch.findFirst.mockResolvedValue({ id: "e2", epoch: 2 });
    messages.insertOne.mockResolvedValue({});

    const { message, recipients } = await service.sendToChannel(ALICE, channelInput);

    expect(message).toMatchObject({ channelId: CHANNEL, scope: "channel", keyEpoch: 2 });
    expect(recipients).toEqual([ALICE, BOB]);
    expect(notifications.notifyOnce).not.toHaveBeenCalled();
  });

  it("refuses a member without SEND_MESSAGES", async () => {
    channelsService.canSend.mockRejectedValue(Object.assign(new Error("x"), { status: 403 }));

    await expect(service.sendToChannel(ALICE, channelInput)).rejects.toMatchObject({ status: 403 });
    expect(messages.insertOne).not.toHaveBeenCalled();
  });

  it("checks SEND_VOICE_MESSAGES for audio", async () => {
    channelsService.canSendVoice.mockRejectedValue(Object.assign(new Error("x"), { status: 403 }));

    await expect(
      service.sendToChannel(ALICE, { ...channelInput, contentType: "audio" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(messages.insertOne).not.toHaveBeenCalled();
  });

  describe("attachments", () => {
    const MEDIA = "66666666-6666-6666-6666-666666666666";
    const image = { ...channelInput, contentType: "image" as const, mediaId: MEDIA };
    const uploaded = { id: MEDIA, uploaderId: ALICE, conversationId: CHANNEL, kind: "image" };

    beforeEach(() => {
      channelKeyEpoch.findFirst.mockResolvedValue({ id: "e2", epoch: 2 });
      messages.insertOne.mockResolvedValue({});
      mediaFile.findUnique.mockResolvedValue(uploaded);
      messages.findOne.mockResolvedValue(null);
    });

    it("needs ATTACH_FILES and stores the media id in the clear", async () => {
      await service.sendToChannel(ALICE, image);
      expect(channelsService.canAttach).toHaveBeenCalledWith(CHANNEL, ALICE);
      expect(messages.insertOne.mock.calls[0]![0]).toMatchObject({ contentType: "image", mediaId: MEDIA });

      channelsService.canAttach.mockRejectedValue(Object.assign(new Error("x"), { status: 403 }));
      await expect(service.sendToChannel(ALICE, image)).rejects.toMatchObject({ status: 403 });
    });

    it("refuses a file someone else uploaded, another conversation's, or another kind", async () => {
      for (const wrong of [
        { ...uploaded, uploaderId: BOB },
        { ...uploaded, conversationId: "other" },
        { ...uploaded, kind: "video" },
        null,
      ]) {
        mediaFile.findUnique.mockResolvedValue(wrong);
        await expect(service.sendToChannel(ALICE, image)).rejects.toMatchObject({ status: 400 });
      }
      expect(messages.insertOne).not.toHaveBeenCalled();
    });

    it("refuses a file already used by another message, but not a retry of the same one", async () => {
      messages.findOne.mockResolvedValue(doc({ senderId: ALICE, clientMessageId: "another-id" }));
      await expect(service.sendToChannel(ALICE, image)).rejects.toMatchObject({ status: 409 });

      messages.findOne.mockResolvedValue(doc({ senderId: ALICE, clientMessageId: input.clientMessageId }));
      await expect(service.sendToChannel(ALICE, image)).resolves.toBeDefined();
    });
  });

  it("refuses a message encrypted with an old epoch (409)", async () => {
    channelKeyEpoch.findFirst.mockResolvedValue({ id: "e3", epoch: 3 });

    await expect(service.sendToChannel(ALICE, channelInput)).rejects.toMatchObject({ status: 409 });
    expect(messages.insertOne).not.toHaveBeenCalled();
  });

  it("reads history only for someone who can view the channel", async () => {
    channelsService.canView.mockRejectedValue(Object.assign(new Error("x"), { status: 403 }));

    await expect(service.channelHistory(ALICE, { channelId: CHANNEL, limit: 30 })).rejects.toMatchObject({
      status: 403,
    });
    expect(messages.find).not.toHaveBeenCalled();
  });
});

describe("remove", () => {
  const CHANNEL = "55555555-5555-5555-5555-555555555555";
  const id = new ObjectId();
  const dmDoc = (over = {}) => doc({ _id: id, mediaId: "m1", ...over });
  const channelDoc = (over = {}) => doc({ _id: id, scope: "channel", channelId: CHANNEL, senderId: BOB, ...over });

  it("lets the author delete a DM: file first, then the document, and tells both sides", async () => {
    messages.findOne.mockResolvedValue(dmDoc());
    mediaFile.findUnique.mockResolvedValue({ storageKey: "media/k" });

    const result = await service.remove(ALICE, { messageId: id.toHexString(), peerId: BOB });

    expect(deleteObject).toHaveBeenCalledWith("media/k");
    expect(messages.deleteOne).toHaveBeenCalledWith({ _id: id });
    expect(mediaFile.deleteMany).toHaveBeenCalledWith({ where: { id: "m1" } });
    expect(result).toEqual({ id: id.toHexString(), channelId: service.dmId(ALICE, BOB), recipients: [ALICE, BOB] });
  });

  it("deletes an image's preview along with the image", async () => {
    messages.findOne.mockResolvedValue(dmDoc());
    mediaFile.findUnique.mockResolvedValue({ storageKey: "media/k", previewKey: "media/k.preview" });

    await service.remove(ALICE, { messageId: id.toHexString(), peerId: BOB });

    expect(deleteObject).toHaveBeenCalledWith("media/k");
    expect(deleteObject).toHaveBeenCalledWith("media/k.preview");
  });

  it("does not let the peer delete a DM message, nor name the wrong peer", async () => {
    messages.findOne.mockResolvedValue(dmDoc());
    await expect(service.remove(BOB, { messageId: id.toHexString(), peerId: ALICE })).rejects.toMatchObject({ status: 403 });

    await expect(service.remove(ALICE, { messageId: id.toHexString(), peerId: CAROL })).rejects.toMatchObject({ status: 400 });
    expect(messages.deleteOne).not.toHaveBeenCalled();
  });

  it("lets a moderator delete a channel message and reaches every viewer", async () => {
    messages.findOne.mockResolvedValue(channelDoc({ mediaId: undefined }));
    channelsService.viewerIds.mockResolvedValue([ALICE, BOB, CAROL]);

    const result = await service.remove(CAROL, { messageId: id.toHexString() });

    expect(channelsService.canManageMessages).toHaveBeenCalledWith(CHANNEL, CAROL);
    expect(result.recipients.sort()).toEqual([ALICE, BOB, CAROL]);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("refuses a member without MANAGE_MESSAGES, and keeps the message", async () => {
    messages.findOne.mockResolvedValue(channelDoc());
    channelsService.canManageMessages.mockRejectedValue(Object.assign(new Error("x"), { status: 403 }));

    await expect(service.remove(CAROL, { messageId: id.toHexString() })).rejects.toMatchObject({ status: 403 });
    expect(messages.deleteOne).not.toHaveBeenCalled();
  });

  it("404s a message that does not exist", async () => {
    messages.findOne.mockResolvedValue(null);
    await expect(service.remove(ALICE, { messageId: id.toHexString() })).rejects.toMatchObject({ status: 404 });
  });
});

describe("replies", () => {
  const original = new ObjectId();

  it("stores answerFor when replying to a message of the same conversation", async () => {
    messages.findOne.mockResolvedValue(doc({ _id: original }));
    messages.insertOne.mockResolvedValue({});

    const message = await service.send(ALICE, { ...input, answerFor: original.toHexString() });

    expect(messages.findOne).toHaveBeenCalledWith({ _id: original, channelId: service.dmId(ALICE, BOB) });
    expect(messages.insertOne.mock.calls[0]![0]).toMatchObject({ answerFor: original.toHexString() });
    expect(message.answerFor).toBe(original.toHexString());
  });

  it("notifies the author of the replied DM message", async () => {
    messages.findOne.mockResolvedValue(doc({ _id: original, senderId: BOB }));
    messages.insertOne.mockResolvedValue({});

    await service.send(ALICE, { ...input, answerFor: original.toHexString() });

    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ tag: "reply", ownerId: ALICE, receiverId: BOB, subtitle: "respondeu sua mensagem" }),
    );
  });

  it("notifies the author of a replied channel message, with where it happened", async () => {
    const CHANNEL = "55555555-5555-5555-5555-555555555555";
    messages.findOne.mockResolvedValue(doc({ _id: original, scope: "channel", channelId: CHANNEL, senderId: BOB }));
    messages.insertOne.mockResolvedValue({});
    channelKeyEpoch.findFirst.mockResolvedValue({ epoch: 1 });
    channelsService.getById.mockResolvedValue({ id: CHANNEL, serverId: "srv", name: "geral" });
    const { peerId: _, ...body } = input;

    await service.sendToChannel(ALICE, {
      ...body,
      channelId: CHANNEL,
      keyEpoch: 1,
      mentions: { everyone: false, userIds: [] },
      answerFor: original.toHexString(),
    });

    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ tag: "reply", receiverId: BOB, serverId: "srv", channelId: CHANNEL }),
    );
  });

  it("does not notify someone replying to themselves", async () => {
    messages.findOne.mockResolvedValue(doc({ _id: original, senderId: ALICE }));
    messages.insertOne.mockResolvedValue({});

    await service.send(ALICE, { ...input, answerFor: original.toHexString() });

    expect(notifications.notify).not.toHaveBeenCalledWith(expect.objectContaining({ tag: "reply" }));
  });

  it("rejects a reply to a message of another conversation", async () => {
    messages.findOne.mockResolvedValue(null); // no message with that id in this conversation

    await expect(service.send(ALICE, { ...input, answerFor: original.toHexString() })).rejects.toMatchObject({ status: 400 });
    expect(messages.insertOne).not.toHaveBeenCalled();
  });
});

describe("react", () => {
  const CHANNEL = "55555555-5555-5555-5555-555555555555";
  const id = new ObjectId();
  const messageId = id.toHexString();
  const afterUpdate = (reactions: unknown[]) => messages.findOneAndUpdate.mockResolvedValue(doc({ _id: id, reactions }));
  /** The update pipeline's two parts: whose reactions it drops, and what it appends. */
  const update = (call: number) => {
    const [filter, added] = messages.findOneAndUpdate.mock.calls[call]![1][0].$set.reactions.$concatArrays;
    return { dropsFrom: filter.$filter.cond.$ne[1], added };
  };

  it("adds a reaction, and the same emoji again removes it", async () => {
    messages.findOne.mockResolvedValue(doc({ _id: id }));
    afterUpdate([{ emoji: "👍", userId: BOB }]);

    const added = await service.react(BOB, { messageId, emoji: "👍", peerId: ALICE });

    expect(update(0)).toEqual({ dropsFrom: BOB, added: [{ emoji: "👍", userId: BOB }] });
    expect(added).toEqual({
      id: messageId,
      channelId: service.dmId(ALICE, BOB),
      reactions: [{ emoji: "👍", userId: BOB }],
      recipients: [BOB, ALICE],
    });

    messages.findOne.mockResolvedValue(doc({ _id: id, reactions: [{ emoji: "👍", userId: BOB }] }));
    afterUpdate([]);

    const removed = await service.react(BOB, { messageId, emoji: "👍", peerId: ALICE });

    expect(update(1)).toEqual({ dropsFrom: BOB, added: [] });
    expect(removed.reactions).toEqual([]);
  });

  it("keeps one reaction per person: another emoji replaces the old one", async () => {
    messages.findOne.mockResolvedValue(doc({ _id: id, reactions: [{ emoji: "👍", userId: BOB }, { emoji: "👍", userId: CAROL }] }));
    afterUpdate([{ emoji: "👍", userId: CAROL }, { emoji: "🔥", userId: BOB }]);

    await service.react(BOB, { messageId, emoji: "🔥", peerId: ALICE });

    // Every reaction of BOB is dropped, CAROL's stays, then the new one goes in.
    expect(update(0)).toEqual({ dropsFrom: BOB, added: [{ emoji: "🔥", userId: BOB }] });
  });

  it("notifies the author of a new reaction, not of a removal nor of their own", async () => {
    messages.findOne.mockResolvedValue(doc({ _id: id })); // ALICE's message
    afterUpdate([{ emoji: "👍", userId: BOB }]);
    await service.react(BOB, { messageId, emoji: "👍", peerId: ALICE });
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ tag: "reaction", ownerId: BOB, receiverId: ALICE, subtitle: "reagiu com 👍 à sua mensagem" }),
    );

    notifications.notify.mockClear();
    messages.findOne.mockResolvedValue(doc({ _id: id, reactions: [{ emoji: "👍", userId: BOB }] }));
    afterUpdate([]);
    await service.react(BOB, { messageId, emoji: "👍", peerId: ALICE });

    messages.findOne.mockResolvedValue(doc({ _id: id }));
    afterUpdate([{ emoji: "👍", userId: ALICE }]);
    await service.react(ALICE, { messageId, emoji: "👍", peerId: BOB });

    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("does not let a stranger react to a DM", async () => {
    messages.findOne.mockResolvedValue(doc({ _id: id }));

    await expect(service.react(CAROL, { messageId, emoji: "👍", peerId: ALICE })).rejects.toMatchObject({ status: 400 });
    expect(messages.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("does not let someone who cannot view the channel react", async () => {
    messages.findOne.mockResolvedValue(doc({ _id: id, scope: "channel", channelId: CHANNEL }));
    channelsService.canView.mockRejectedValue(Object.assign(new Error("x"), { status: 404 }));

    await expect(service.react(CAROL, { messageId, emoji: "👍" })).rejects.toMatchObject({ status: 404 });
    expect(messages.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects a reaction on a missing message", async () => {
    messages.findOne.mockResolvedValue(null);
    await expect(service.react(BOB, { messageId, emoji: "👍", peerId: ALICE })).rejects.toMatchObject({ status: 404 });
  });

  it("caps distinct emojis per message, but still lets people join an existing one", async () => {
    const emojis = [..."😀😁😂🤣😃😄😅😆😉😊😋😎😍😘🥰😗😙😚🙂🤗"];
    const reactions = emojis.map((emoji) => ({ emoji, userId: ALICE }));
    messages.findOne.mockResolvedValue(doc({ _id: id, reactions }));

    await expect(service.react(BOB, { messageId, emoji: "🔥", peerId: ALICE })).rejects.toMatchObject({ status: 409 });

    afterUpdate(reactions);
    await expect(service.react(BOB, { messageId, emoji: "😀", peerId: ALICE })).resolves.toBeDefined();
  });
});

describe("channel keys", () => {
  const CHANNEL = "55555555-5555-5555-5555-555555555555";
  const share = (recipientId: string) => ({ recipientId, encryptedKey: "a2V5", iv: "aXZpdml2aXY=" });

  it("returns the caller's shares, who lacks the key, and asks to rotate after someone left", async () => {
    channelKeyShare.findMany.mockResolvedValue([
      { epoch: { epoch: 1 }, encryptedKey: "k1", iv: "i1", wrapperPublicKey: "p" },
    ]);
    channelKeyEpoch.findFirst.mockResolvedValue({ epoch: 1, shares: [{ recipientId: ALICE }, { recipientId: CAROL }] });
    getActiveKeys.mockResolvedValue([
      { userId: ALICE, publicKey: "a" },
      { userId: BOB, publicKey: "b" },
    ]);

    const keys = await service.channelKeys(CHANNEL, ALICE);

    expect(keys.latest).toBe(1);
    expect(keys.shares).toEqual([{ epoch: 1, encryptedKey: "k1", iv: "i1", wrapperPublicKey: "p" }]);
    expect(keys.recipients).toEqual([
      { userId: ALICE, publicKey: "a", hasShare: true },
      { userId: BOB, publicKey: "b", hasShare: false },
    ]);
    expect(keys.rotate).toBe(true); // CAROL holds the key but is no longer a viewer
  });

  it("creates the next epoch with the wrapper key taken from the directory", async () => {
    channelKeyEpoch.findFirst.mockResolvedValue({ id: "e1", epoch: 1 });

    await service.createEpoch(CHANNEL, ALICE, { epoch: 2, shares: [share(ALICE), share(BOB)] });

    expect(channelKeyEpoch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channelId: CHANNEL,
        epoch: 2,
        shares: {
          create: [
            expect.objectContaining({ recipientId: ALICE, wrappedBy: ALICE, wrapperPublicKey: "YWxpY2U=" }),
            expect.objectContaining({ recipientId: BOB, wrappedBy: ALICE, wrapperPublicKey: "YWxpY2U=" }),
          ],
        },
      }),
    });
  });

  it("refuses to skip or repeat an epoch (409)", async () => {
    channelKeyEpoch.findFirst.mockResolvedValue({ id: "e1", epoch: 1 });

    await expect(service.createEpoch(CHANNEL, ALICE, { epoch: 1, shares: [share(ALICE)] })).rejects.toMatchObject({
      status: 409,
    });
    expect(channelKeyEpoch.create).not.toHaveBeenCalled();
  });

  it("never wraps the key for someone who cannot view the channel", async () => {
    channelKeyEpoch.findFirst.mockResolvedValue(null);

    await expect(
      service.createEpoch(CHANNEL, ALICE, { epoch: 1, shares: [share(ALICE), share(CAROL)] }),
    ).rejects.toMatchObject({ status: 403 });
    expect(channelKeyEpoch.create).not.toHaveBeenCalled();
  });

  it("only lets a holder of the current key hand it out", async () => {
    channelKeyEpoch.findFirst.mockResolvedValue({ id: "e1", epoch: 1 });
    channelKeyShare.findUnique.mockResolvedValue(null);

    await expect(service.addShares(CHANNEL, 1, BOB, { shares: [share(ALICE)] })).rejects.toMatchObject({
      status: 403,
    });
    expect(channelKeyShare.createMany).not.toHaveBeenCalled();
  });

  it("adds shares for viewers who lack the current key", async () => {
    channelKeyEpoch.findFirst.mockResolvedValue({ id: "e1", epoch: 1 });
    channelKeyShare.findUnique.mockResolvedValue({ recipientId: ALICE });

    await service.addShares(CHANNEL, 1, ALICE, { shares: [share(BOB)] });

    expect(channelKeyShare.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ epochId: "e1", recipientId: BOB, wrappedBy: ALICE })],
      skipDuplicates: true,
    });
  });
});
