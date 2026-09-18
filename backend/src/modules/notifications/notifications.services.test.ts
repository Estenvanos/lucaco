import { jest } from "@jest/globals";

const mock = () => jest.fn<(...args: any[]) => any>();

const notification = {
  create: mock(),
  findFirst: mock(),
  findMany: mock(),
  findUnique: mock(),
  delete: mock(),
  deleteMany: mock(),
};
jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma: { notification } }));

const emitToUser = mock();
jest.unstable_mockModule("../../lib/socket.js", () => ({ emitToUser }));

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";
const alice = { id: ALICE, username: "alice", displayName: null, avatarUrl: null };

const getProfiles = mock();
getProfiles.mockImplementation(async () => new Map([[ALICE, alice]]));
jest.unstable_mockModule("../users/users.services.js", () => ({ getProfiles }));

const notifications = await import("./notifications.services.js");

const row = (over: Record<string, unknown> = {}) => ({
  id: "n1",
  tag: "friend_accepted",
  title: "alice aceitou seu pedido de amizade",
  subtitle: null,
  ownerId: ALICE,
  receiverId: BOB,
  createdAt: new Date(),
  ...over,
});

const rejects = (promise: Promise<unknown>, status: number) =>
  expect(promise).rejects.toMatchObject({ status });

describe("notify", () => {
  it("stores it and pushes it live to the receiver's room only", async () => {
    notification.create.mockResolvedValue(row());

    const result = await notifications.notify({
      tag: "friend_accepted",
      title: "alice aceitou seu pedido de amizade",
      ownerId: ALICE,
      receiverId: BOB,
    });

    expect(emitToUser).toHaveBeenCalledTimes(1);
    expect(emitToUser).toHaveBeenCalledWith(BOB, "notification:new", result);
    expect(result.owner).toEqual(alice);
  });

  it("never sends the owner's email to the receiver", async () => {
    notification.create.mockResolvedValue(row());
    const result = await notifications.notify({ tag: "friend_accepted", title: "t", ownerId: ALICE, receiverId: BOB });
    expect(result.owner).not.toHaveProperty("email");
  });
});

describe("list", () => {
  it("returns only the receiver's notifications", async () => {
    notification.findMany.mockResolvedValue([row()]);
    await notifications.list(BOB);
    expect(notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { receiverId: BOB } }));
  });
});

describe("dismissFriendRequest", () => {
  it("deletes the request whichever side sent it and tells the receiver", async () => {
    notification.findMany.mockResolvedValue([row({ id: "r1", tag: "friend_request" })]);

    await notifications.dismissFriendRequest(BOB, ALICE);

    expect(notification.findMany).toHaveBeenCalledWith({
      where: {
        tag: "friend_request",
        OR: [
          { ownerId: BOB, receiverId: ALICE },
          { ownerId: ALICE, receiverId: BOB },
        ],
      },
    });
    expect(notification.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["r1"] } } });
    expect(emitToUser).toHaveBeenCalledWith(BOB, "notification:removed", { id: "r1" });
  });

  it("does nothing when there is no pending request", async () => {
    notification.findMany.mockResolvedValue([]);
    await notifications.dismissFriendRequest(BOB, ALICE);
    expect(notification.deleteMany).not.toHaveBeenCalled();
  });
});

describe("remove", () => {
  it("lets the receiver dismiss a plain notification", async () => {
    notification.findUnique.mockResolvedValue(row());
    await notifications.remove(BOB, "n1");
    expect(notification.delete).toHaveBeenCalledWith({ where: { id: "n1" } });
  });

  it("404s on someone else's notification, without deleting it", async () => {
    notification.findUnique.mockResolvedValue(row());
    await rejects(notifications.remove(ALICE, "n1"), 404);
    expect(notification.delete).not.toHaveBeenCalled();
  });

  it("404s when it does not exist", async () => {
    notification.findUnique.mockResolvedValue(null);
    await rejects(notifications.remove(BOB, "n1"), 404);
  });

  it("refuses to dismiss a friend request, which must be answered instead", async () => {
    notification.findUnique.mockResolvedValue(row({ tag: "friend_request" }));
    await rejects(notifications.remove(BOB, "n1"), 409);
    expect(notification.delete).not.toHaveBeenCalled();
  });
});

describe("notifyOnce", () => {
  const input = { tag: "new_message" as const, title: "alice te mandou uma mensagem", ownerId: ALICE, receiverId: BOB };

  it("creates the notice when there is none unread", async () => {
    notification.findFirst.mockResolvedValue(null);
    notification.create.mockResolvedValue(row({ tag: "new_message" }));
    await notifications.notifyOnce(input);
    expect(notification.create).toHaveBeenCalledWith({ data: input });
  });

  it("does not stack a second notice for every message", async () => {
    notification.findFirst.mockResolvedValue(row({ tag: "new_message" }));
    await notifications.notifyOnce(input);
    expect(notification.create).not.toHaveBeenCalled();
    expect(emitToUser).not.toHaveBeenCalled();
  });
});

describe("dismissFrom", () => {
  it("deletes the owner's notices of that tag for the receiver and tells the receiver", async () => {
    notification.findMany.mockResolvedValue([row({ id: "m1", tag: "new_message" })]);

    await notifications.dismissFrom(BOB, ALICE, "new_message");

    expect(notification.findMany).toHaveBeenCalledWith({ where: { tag: "new_message", ownerId: ALICE, receiverId: BOB } });
    expect(notification.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["m1"] } } });
    expect(emitToUser).toHaveBeenCalledWith(BOB, "notification:removed", { id: "m1" });
  });
});
