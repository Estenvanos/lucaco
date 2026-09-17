import { jest } from "@jest/globals";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();

const user = { findUnique: mock(), update: mock() };
const store = jest.fn<(...args: unknown[]) => Promise<string>>();
const remove = jest.fn<(key: string) => Promise<void>>();

jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma: { user } }));
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
