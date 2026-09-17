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
jest.unstable_mockModule("../users/users.services.js", () => ({
  getById: jest.fn(async (id: string) => ({ id })),
}));

const friends = await import("./friends.services.js");

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

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

    const result = await friends.request(ALICE, BOB);

    expect(friendship.create).toHaveBeenCalledWith({
      data: { userLowId: ALICE, userHighId: BOB, requestedBy: ALICE },
    });
    expect(result).toMatchObject({ userId: BOB, status: "pending", incoming: false });
  });

  it("accepts the pending invite instead of creating a duplicate row", async () => {
    friendship.findUnique.mockResolvedValue(row({ requestedBy: BOB }));
    friendship.update.mockResolvedValue(row({ requestedBy: BOB, status: "accepted" }));

    const result = await friends.request(ALICE, BOB);

    expect(friendship.create).not.toHaveBeenCalled();
    expect(result.status).toBe("accepted");
  });

  it("refuses self, duplicates, existing friends and blocked users", async () => {
    await rejects(friends.request(ALICE, ALICE), 409, /yourself/);

    friendship.findUnique.mockResolvedValue(row());
    await rejects(friends.request(ALICE, BOB), 409, /already sent/);

    friendship.findUnique.mockResolvedValue(row({ status: "accepted" }));
    await rejects(friends.request(ALICE, BOB), 409, /already friends/);

    friendship.findUnique.mockResolvedValue(row({ status: "blocked", blockedBy: BOB }));
    await rejects(friends.request(ALICE, BOB), 403, /blocked/);
  });
});

describe("accept", () => {
  it("lets only the invited side accept", async () => {
    friendship.findUnique.mockResolvedValue(row({ requestedBy: ALICE }));
    await rejects(friends.accept(ALICE, BOB), 403);

    friendship.findUnique.mockResolvedValue(row({ requestedBy: BOB }));
    friendship.update.mockResolvedValue(row({ requestedBy: BOB, status: "accepted" }));
    await expect(friends.accept(ALICE, BOB)).resolves.toMatchObject({ status: "accepted" });
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
