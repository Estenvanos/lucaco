import { jest } from "@jest/globals";
import { HttpError } from "../../lib/http-error.js";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();

const friendship = {
  findUnique: mock(),
  findMany: mock(),
  create: mock(),
  update: mock(),
  upsert: mock(),
  delete: mock(),
};

jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma: { friendship } }));
const USERS: Record<string, string> = {
  alice: "11111111-1111-1111-1111-111111111111",
  bob: "22222222-2222-2222-2222-222222222222",
};
jest.unstable_mockModule("../users/users.services.js", () => ({
  getById: jest.fn(async (id: string) => ({ id, username: id === USERS.alice ? "alice" : "bob", displayName: null })),
  getProfiles: jest.fn(async (ids: string[]) =>
    new Map(ids.map((id) => [id, { id, username: id === USERS.alice ? "alice" : "bob", displayName: null, avatarUrl: null }])),
  ),
  getByUsername: jest.fn(async (username: string) => {
    if (!USERS[username]) throw new HttpError(404, "User not found");
    return { id: USERS[username] };
  }),
}));
const notifications = { notify: mock(), dismissFriendRequest: mock() };
jest.unstable_mockModule("../notifications/notifications.services.js", () => notifications);

const friends = await import("./friends.services.js");

const ALICE = USERS.alice;
const BOB = USERS.bob;

const row = (over: Record<string, unknown> = {}) => ({
  id: "row-1",
  userLowId: ALICE,
  userHighId: BOB,
  status: "pending",
  requestedBy: ALICE,
  blockedBy: null,
  createdAt: new Date(),
  respondedAt: null,
  ...over,
});

const rejects = (promise: Promise<unknown>, status: number, message?: string | RegExp) =>
  expect(promise).rejects.toMatchObject({
    status,
    ...(message ? { message: expect.stringMatching(message) } : {}),
  });

describe("canonicalPair", () => {
  it("orders the pair the same way regardless of direction", () => {
    expect(friends.canonicalPair(ALICE, BOB)).toEqual(friends.canonicalPair(BOB, ALICE));
  });

  it("puts the smaller id in userLowId, satisfying the CHECK constraint", () => {
    const pair = friends.canonicalPair(BOB, ALICE);
    expect(pair.userLowId < pair.userHighId).toBe(true);
  });
});

describe("request", () => {
  it("creates a pending row pointing at the sender", async () => {
    friendship.findUnique.mockResolvedValue(null);
    friendship.create.mockResolvedValue(row());

    const result = await friends.request(ALICE, { username: "bob" });

    expect(friendship.create).toHaveBeenCalledWith({
      data: { userLowId: ALICE, userHighId: BOB, requestedBy: ALICE },
    });
    expect(result).toMatchObject({ userId: BOB, status: "pending", incoming: false });
  });

  it("notifies the invited user, with the note as the subtitle", async () => {
    friendship.findUnique.mockResolvedValue(null);
    friendship.create.mockResolvedValue(row());

    await friends.request(ALICE, { username: "bob", message: "bora jogar" });

    expect(notifications.notify).toHaveBeenCalledWith({
      tag: "friend_request",
      title: "alice quer ser seu amigo",
      subtitle: "bora jogar",
      ownerId: ALICE,
      receiverId: BOB,
    });
  });

  it("404s for a username that does not exist, before writing anything", async () => {
    await rejects(friends.request(ALICE, { username: "ghost" }), 404);
    expect(friendship.create).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("accepts the pending invite instead of creating a duplicate row", async () => {
    friendship.findUnique.mockResolvedValue(row({ requestedBy: BOB }));
    friendship.update.mockResolvedValue(row({ requestedBy: BOB, status: "accepted" }));

    const result = await friends.request(ALICE, { username: "bob" });

    expect(friendship.create).not.toHaveBeenCalled();
    expect(notifications.dismissFriendRequest).toHaveBeenCalledWith(ALICE, BOB);
    expect(result.status).toBe("accepted");
  });

  it("refuses self, duplicates, existing friends and blocked users", async () => {
    await rejects(friends.request(ALICE, { username: "alice" }), 409, /yourself/);

    friendship.findUnique.mockResolvedValue(row());
    await rejects(friends.request(ALICE, { username: "bob" }), 409, /already sent/);

    friendship.findUnique.mockResolvedValue(row({ status: "accepted" }));
    await rejects(friends.request(ALICE, { username: "bob" }), 409, /already friends/);

    friendship.findUnique.mockResolvedValue(row({ status: "blocked", blockedBy: BOB }));
    await rejects(friends.request(ALICE, { username: "bob" }), 403, /blocked/);
  });
});

describe("list", () => {
  it("names the other side with a public profile, never the email", async () => {
    friendship.findMany.mockResolvedValue([row({ status: "accepted" })]);

    const [friend] = await friends.list(ALICE, { status: "accepted" });

    expect(friend.user).toEqual({ id: BOB, username: "bob", displayName: null, avatarUrl: null });
    expect(friend.user).not.toHaveProperty("email");
  });
});

describe("accept", () => {
  it("lets only the invited side accept", async () => {
    friendship.findUnique.mockResolvedValue(row({ requestedBy: ALICE }));
    await rejects(friends.accept(ALICE, BOB), 403);

    friendship.findUnique.mockResolvedValue(row({ requestedBy: BOB }));
    friendship.update.mockResolvedValue(row({ requestedBy: BOB, status: "accepted" }));
    await expect(friends.accept(ALICE, BOB)).resolves.toMatchObject({ status: "accepted" });
    expect(notifications.dismissFriendRequest).toHaveBeenCalledWith(ALICE, BOB);
  });

  it("tells the requester their request was accepted", async () => {
    friendship.findUnique.mockResolvedValue(row({ requestedBy: BOB }));
    friendship.update.mockResolvedValue(row({ requestedBy: BOB, status: "accepted" }));

    await friends.accept(ALICE, BOB);

    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ tag: "friend_accepted", ownerId: ALICE, receiverId: BOB }),
    );
  });

  it("404s when there is no pending request", async () => {
    friendship.findUnique.mockResolvedValue(null);
    await rejects(friends.accept(ALICE, BOB), 404);

    friendship.findUnique.mockResolvedValue(row({ status: "accepted" }));
    await rejects(friends.accept(ALICE, BOB), 404);
  });
});

describe("areFriends", () => {
  it("is true only for an accepted pair", async () => {
    friendship.findUnique.mockResolvedValue(row({ status: "accepted" }));
    await expect(friends.areFriends(ALICE, BOB)).resolves.toBe(true);

    friendship.findUnique.mockResolvedValue(row({ status: "pending" }));
    await expect(friends.areFriends(ALICE, BOB)).resolves.toBe(false);
  });

  it("is false for the same user, without touching the database", async () => {
    await expect(friends.areFriends(ALICE, ALICE)).resolves.toBe(false);
    expect(friendship.findUnique).not.toHaveBeenCalled();
  });
});

describe("block and unblock", () => {
  it("records who blocked, which the blocked_has_blocker constraint requires", async () => {
    friendship.upsert.mockResolvedValue(row({ status: "blocked", blockedBy: ALICE }));

    const result = await friends.block(ALICE, BOB);

    expect(friendship.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userLowId: ALICE, userHighId: BOB, requestedBy: ALICE, status: "blocked", blockedBy: ALICE },
      }),
    );
    expect(result.blockedByMe).toBe(true);
    // A blocked sender's request must not stay waiting in the notifications.
    expect(notifications.dismissFriendRequest).toHaveBeenCalledWith(ALICE, BOB);
  });

  it("lets only the blocker unblock", async () => {
    friendship.findUnique.mockResolvedValue(row({ status: "blocked", blockedBy: BOB }));
    await rejects(friends.unblock(ALICE, BOB), 403);

    friendship.findUnique.mockResolvedValue(row({ status: "blocked", blockedBy: ALICE }));
    await expect(friends.unblock(ALICE, BOB)).resolves.toBeUndefined();
    expect(friendship.delete).toHaveBeenCalledWith({ where: { id: "row-1" } });
  });
});

describe("remove", () => {
  it("deletes the row for a decline or an unfriend", async () => {
    friendship.findUnique.mockResolvedValue(row({ status: "accepted" }));
    await friends.remove(ALICE, BOB);
    expect(friendship.delete).toHaveBeenCalledWith({ where: { id: "row-1" } });
    expect(notifications.dismissFriendRequest).toHaveBeenCalledWith(ALICE, BOB);
  });

  it("does not let the blocked side delete the block", async () => {
    friendship.findUnique.mockResolvedValue(row({ status: "blocked", blockedBy: BOB }));
    await rejects(friends.remove(ALICE, BOB), 403);
    expect(friendship.delete).not.toHaveBeenCalled();
  });

  it("uses HttpError so the error handler maps it to a status", async () => {
    friendship.findUnique.mockResolvedValue(null);
    await expect(friends.remove(ALICE, BOB)).rejects.toBeInstanceOf(HttpError);
  });
});
