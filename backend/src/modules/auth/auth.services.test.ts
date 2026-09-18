import { jest } from "@jest/globals";
import { createHash } from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();

const SECRET = "test-secret-with-at-least-32-characters";

const session = { create: mock(), findUnique: mock(), updateMany: mock() };
const user = { create: mock(), findFirst: mock(), findUnique: mock(), update: mock() };

jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma: { session, user } }));
jest.unstable_mockModule("../../env.js", () => ({
  env: { JWT_ACCESS_SECRET: SECRET, JWT_ACCESS_TTL: "15m", REFRESH_TTL_DAYS: 30, NODE_ENV: "test" },
}));

const auth = await import("./auth.services.js");

const USER_ID = "11111111-1111-1111-1111-111111111111";
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

const sessionRow = (over: Record<string, unknown> = {}) => ({
  id: "session-1",
  userId: USER_ID,
  refreshTokenHash: sha256("plain-token"),
  expiresAt: new Date(Date.now() + 86_400_000),
  revokedAt: null,
  ...over,
});

beforeEach(() => {
  session.create.mockResolvedValue(sessionRow());
  session.updateMany.mockResolvedValue({ count: 1 });
});

describe("verifyAccessToken", () => {
  it("returns the payload of a token signed with the same secret", () => {
    const token = jwt.sign({ sid: "session-1" }, SECRET, { subject: USER_ID, expiresIn: "15m" });

    expect(auth.verifyAccessToken(token)).toMatchObject({ sub: USER_ID, sid: "session-1" });
  });

  it("rejects a token signed with another secret", () => {
    const forged = jwt.sign({ sid: "session-1" }, "another-secret-000000000000000000", { subject: USER_ID });

    expect(() => auth.verifyAccessToken(forged)).toThrow(expect.objectContaining({ status: 401 }));
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign({ sid: "s" }, SECRET, { subject: USER_ID, expiresIn: "-1s" });

    expect(() => auth.verifyAccessToken(expired)).toThrow(expect.objectContaining({ status: 401 }));
  });

  it("rejects garbage and an empty string instead of throwing a raw jwt error", () => {
    expect(() => auth.verifyAccessToken("")).toThrow(expect.objectContaining({ status: 401 }));
    expect(() => auth.verifyAccessToken("not.a.token")).toThrow(expect.objectContaining({ status: 401 }));
  });

  // HS256 only: an "alg: none" token must never be accepted.
  it("rejects an unsigned token", () => {
    const unsigned = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${Buffer.from(
      JSON.stringify({ sub: USER_ID, sid: "s" }),
    ).toString("base64url")}.`;

    expect(() => auth.verifyAccessToken(unsigned)).toThrow(expect.objectContaining({ status: 401 }));
  });
});

describe("signIn", () => {
  it("rejects an unknown login with the same error as a wrong password", async () => {
    user.findFirst.mockResolvedValue(null);

    await expect(auth.signIn({ login: "ghost", password: "whatever" }, {})).rejects.toMatchObject({
      status: 401,
      message: "Invalid credentials",
    });
  });

  it("looks up by email when the login contains @, lowercased", async () => {
    user.findFirst.mockResolvedValue(null);

    await auth.signIn({ login: "Person@Example.COM", password: "x" }, {}).catch(() => {});

    expect(user.findFirst).toHaveBeenCalledWith({ where: { email: "person@example.com" } });
  });

  it("looks up by username otherwise", async () => {
    user.findFirst.mockResolvedValue(null);

    await auth.signIn({ login: "person", password: "x" }, {}).catch(() => {});

    expect(user.findFirst).toHaveBeenCalledWith({ where: { username: "person" } });
  });
});

describe("refresh", () => {
  it("stores only the sha256 of the new token and returns the plaintext once", async () => {
    session.findUnique.mockResolvedValue(sessionRow());

    const { refreshToken } = await auth.refresh("plain-token", {});

    const stored = session.create.mock.calls[0]?.[0] as { data: { refreshTokenHash: string } };
    expect(stored.data.refreshTokenHash).toBe(sha256(refreshToken));
    expect(stored.data.refreshTokenHash).not.toBe(refreshToken);
  });

  it("finds the session by hash, never by the raw token", async () => {
    session.findUnique.mockResolvedValue(sessionRow());

    await auth.refresh("plain-token", {});

    expect(session.findUnique).toHaveBeenCalledWith({
      where: { refreshTokenHash: sha256("plain-token") },
    });
  });

  it("revokes every session of the user when a rotated token is reused", async () => {
    session.findUnique.mockResolvedValue(sessionRow({ revokedAt: new Date() }));

    await expect(auth.refresh("plain-token", {})).rejects.toMatchObject({
      status: 401,
      message: "Refresh token reuse detected",
    });
    expect(session.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("rejects an expired session", async () => {
    session.findUnique.mockResolvedValue(sessionRow({ expiresAt: new Date(Date.now() - 1000) }));

    await expect(auth.refresh("plain-token", {})).rejects.toMatchObject({ status: 401 });
    expect(session.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown token", async () => {
    session.findUnique.mockResolvedValue(null);

    await expect(auth.refresh("plain-token", {})).rejects.toMatchObject({ status: 401 });
  });

  // Two concurrent refreshes: the conditional update means only one wins.
  it("rejects the loser of a rotation race", async () => {
    session.findUnique.mockResolvedValue(sessionRow());
    session.updateMany.mockResolvedValue({ count: 0 });

    await expect(auth.refresh("plain-token", {})).rejects.toMatchObject({ status: 401 });
    expect(session.create).not.toHaveBeenCalled();
  });
});

describe("logout", () => {
  it("revokes by hash and stays quiet for an unknown token", async () => {
    await expect(auth.logout("plain-token")).resolves.toBeUndefined();

    expect(session.updateMany).toHaveBeenCalledWith({
      where: { refreshTokenHash: sha256("plain-token"), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe("changePassword", () => {
  const PASSWORD = "old-password-123";
  let storedHash: string;

  beforeAll(async () => {
    storedHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  });

  beforeEach(() => user.findUnique.mockResolvedValue({ id: USER_ID, passwordHash: storedHash }));

  it("403s on a wrong current password and changes nothing", async () => {
    await expect(
      auth.changePassword(USER_ID, "session-1", { currentPassword: "wrong", newPassword: "new-password-123" }),
    ).rejects.toMatchObject({ status: 403 });

    expect(user.update).not.toHaveBeenCalled();
    expect(session.updateMany).not.toHaveBeenCalled();
  });

  it("stores an argon2id hash, never the new password itself", async () => {
    await auth.changePassword(USER_ID, "session-1", { currentPassword: PASSWORD, newPassword: "new-password-123" });

    const { passwordHash } = user.update.mock.calls[0]![0].data;
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    await expect(argon2.verify(passwordHash, "new-password-123")).resolves.toBe(true);
  });

  it("signs out every other session but keeps the current one", async () => {
    await auth.changePassword(USER_ID, "session-1", { currentPassword: PASSWORD, newPassword: "new-password-123" });

    expect(session.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, revokedAt: null, id: { not: "session-1" } },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe("changeEmail", () => {
  const PASSWORD = "old-password-123";
  let storedHash: string;

  beforeAll(async () => {
    storedHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  });

  it("403s on a wrong password before looking at the new email", async () => {
    user.findUnique.mockResolvedValue({ id: USER_ID, passwordHash: storedHash });

    await expect(
      auth.changeEmail(USER_ID, { currentPassword: "wrong", email: "new@example.com" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(user.update).not.toHaveBeenCalled();
  });

  it("409s when another account already uses the email", async () => {
    user.findUnique
      .mockResolvedValueOnce({ id: USER_ID, passwordHash: storedHash })
      .mockResolvedValueOnce({ id: "someone-else" });

    await expect(
      auth.changeEmail(USER_ID, { currentPassword: PASSWORD, email: "taken@example.com" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(user.update).not.toHaveBeenCalled();
  });

  it("saves the new email with the right password", async () => {
    user.findUnique.mockResolvedValueOnce({ id: USER_ID, passwordHash: storedHash }).mockResolvedValueOnce(null);
    user.update.mockResolvedValue({ id: USER_ID, email: "new@example.com" });

    await auth.changeEmail(USER_ID, { currentPassword: PASSWORD, email: "new@example.com" });

    expect(user.update).toHaveBeenCalledWith({ where: { id: USER_ID }, data: { email: "new@example.com" } });
  });
});
