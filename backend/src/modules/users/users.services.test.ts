import { jest } from "@jest/globals";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();

const user = { findUnique: mock(), findMany: mock(), update: mock() };
const userKey = { findFirst: mock(), create: mock(), updateMany: mock() };
const $transaction = jest.fn(async (fn: any) => fn({ userKey }));
const store = jest.fn<(...args: unknown[]) => Promise<string>>();
const remove = jest.fn<(key: string) => Promise<void>>();

jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma: { user, userKey, $transaction } }));
jest.unstable_mockModule("../../lib/storage.js", () => ({ signedGetUrl: jest.fn(async (k: string) => `signed:${k}`) }));
jest.unstable_mockModule("../images/images.services.js", () => ({ store, remove }));

const users = await import("./users.services.js");

const USER_ID = "11111111-1111-1111-1111-111111111111";
const userRow = (over: Record<string, unknown> = {}) => ({
  id: USER_ID,
  username: "person",
  email: "person@example.com",
  passwordHash: "argon2id$secret",
  displayName: null,
  avatarUrl: null,
  status: "online" as const,
  theme: "system" as const,
  notificationsMuted: false,
  hiddenNotificationTags: [],
  audioInputId: null,
  audioOutputId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const file = { mimetype: "image/png" as const, size: 10, buffer: Buffer.alloc(10) };

beforeEach(() => {
  store.mockResolvedValue("images/avatars/new.webp");
  remove.mockResolvedValue(undefined);
});

describe("toPublicUser", () => {
  it("never leaks the password hash", async () => {
    const publicUser = await users.toPublicUser(userRow());

    expect(publicUser).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(publicUser)).not.toContain("argon2id");
  });

  it("signs the stored avatar key and keeps null as null", async () => {
    await expect(users.toPublicUser(userRow({ avatarUrl: "images/avatars/a.webp" }))).resolves.toMatchObject({
      avatarUrl: "signed:images/avatars/a.webp",
    });
    await expect(users.toPublicUser(userRow())).resolves.toMatchObject({ avatarUrl: null });
  });
});

describe("settings", () => {
  it("go out with the owner's own user, still without the hash", async () => {
    const row = userRow({ theme: "light", audioInputId: "mic-1", hiddenNotificationTags: ["new_message"] });

    const publicUser = await users.toPublicUser(row);

    expect(publicUser.settings).toEqual({
      theme: "light",
      notificationsMuted: false,
      hiddenNotificationTags: ["new_message"],
      audioInputId: "mic-1",
      audioOutputId: null,
    });
    expect(JSON.stringify(publicUser)).not.toContain("argon2id");
  });

  it("stores only the fields that were sent", async () => {
    user.update.mockResolvedValue(userRow({ notificationsMuted: true }));

    await users.updateSettings(USER_ID, { notificationsMuted: true });

    expect(user.update).toHaveBeenCalledWith({ where: { id: USER_ID }, data: { notificationsMuted: true } });
  });

  it("stay out of the public profile other users see", async () => {
    user.findMany.mockResolvedValue([userRow({ audioInputId: "mic-1" })]);

    const profile = (await users.getProfiles([USER_ID])).get(USER_ID);

    expect(profile).not.toHaveProperty("settings");
    expect(JSON.stringify(profile)).not.toContain("mic-1");
  });
});

describe("updateProfile", () => {
  it("409s when someone else already has the username", async () => {
    user.findUnique.mockResolvedValue(userRow({ id: "22222222-2222-2222-2222-222222222222", username: "taken" }));

    await expect(users.updateProfile(USER_ID, { username: "taken" })).rejects.toMatchObject({ status: 409 });
    expect(user.update).not.toHaveBeenCalled();
  });

  it("lets the user resend their own username with a new display name", async () => {
    user.findUnique.mockResolvedValue(userRow());
    user.update.mockResolvedValue(userRow({ displayName: "Pessoa" }));

    await users.updateProfile(USER_ID, { username: "person", displayName: "Pessoa" });

    expect(user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { username: "person", displayName: "Pessoa" },
    });
  });
});

describe("updateStatus", () => {
  it("stores the chosen status on the user's own row", async () => {
    user.update.mockResolvedValue(userRow({ status: "dnd" }));

    await expect(users.updateStatus(USER_ID, { status: "dnd" })).resolves.toMatchObject({ status: "dnd" });
    expect(user.update).toHaveBeenCalledWith({ where: { id: USER_ID }, data: { status: "dnd" } });
  });
});

describe("getById", () => {
  it("404s for an unknown id", async () => {
    user.findUnique.mockResolvedValue(null);
    await expect(users.getById(USER_ID)).rejects.toMatchObject({ status: 404 });
  });
});

describe("updateAvatar", () => {
  it("stores the new image under the user's folder and saves the key", async () => {
    user.findUnique.mockResolvedValue(userRow());
    user.update.mockResolvedValue(userRow({ avatarUrl: "images/avatars/new.webp" }));

    await users.updateAvatar(USER_ID, file);

    expect(store).toHaveBeenCalledWith(file, "avatars", USER_ID);
    expect(user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { avatarUrl: "images/avatars/new.webp" },
    });
  });

  it("deletes the previous object, and only after the row points at the new one", async () => {
    user.findUnique.mockResolvedValue(userRow({ avatarUrl: "images/avatars/old.webp" }));
    user.update.mockResolvedValue(userRow({ avatarUrl: "images/avatars/new.webp" }));

    await users.updateAvatar(USER_ID, file);

    expect(remove).toHaveBeenCalledWith("images/avatars/old.webp");
    expect(user.update.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]!);
  });

  it("does not fail the request when deleting the old object fails", async () => {
    user.findUnique.mockResolvedValue(userRow({ avatarUrl: "images/avatars/old.webp" }));
    user.update.mockResolvedValue(userRow({ avatarUrl: "images/avatars/new.webp" }));
    remove.mockRejectedValue(new Error("storage down"));

    await expect(users.updateAvatar(USER_ID, file)).resolves.toMatchObject({
      avatarUrl: "images/avatars/new.webp",
    });
  });
});

describe("publishKey", () => {
  const keyRow = {
    id: "key-1",
    userId: USER_ID,
    publicKey: "c3BraQ==",
    algorithm: "ECDH-P256",
    isActive: true,
    createdAt: new Date(),
  };

  it("deactivates the previous key before storing the new one", async () => {
    userKey.create.mockResolvedValue(keyRow);

    await users.publishKey(USER_ID, { publicKey: "c3BraQ==", algorithm: "ECDH-P256" });

    expect(userKey.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, isActive: true },
      data: { isActive: false },
    });
    expect(userKey.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      userKey.create.mock.invocationCallOrder[0]!,
    );
  });

  it("stores only the public half", async () => {
    userKey.create.mockResolvedValue(keyRow);

    await users.publishKey(USER_ID, { publicKey: "c3BraQ==", algorithm: "ECDH-P256" });

    expect(userKey.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, publicKey: "c3BraQ==", algorithm: "ECDH-P256" },
    });
    expect(JSON.stringify(userKey.create.mock.calls[0])).not.toMatch(/private/i);
  });

  it("404s until the peer has published a key, so nobody encrypts to a guess", async () => {
    userKey.findFirst.mockResolvedValue(null);

    await expect(users.getActiveKey(USER_ID)).rejects.toMatchObject({ status: 404 });
  });

  it("reads the active key only", async () => {
    userKey.findFirst.mockResolvedValue(keyRow);

    await expect(users.getActiveKey(USER_ID)).resolves.toMatchObject({ publicKey: "c3BraQ==" });
    expect(userKey.findFirst).toHaveBeenCalledWith({ where: { userId: USER_ID, isActive: true } });
  });
});
