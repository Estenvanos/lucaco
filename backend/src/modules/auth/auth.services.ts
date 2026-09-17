import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../env.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import type { SignInInput, SignUpInput } from "./auth.schema.js";

const DUMMY_HASH = await argon2.hash("timing-equalizer");

export type SessionMeta = { userAgent?: string; ip?: string };

export type AccessPayload = { sub: string; sid: string; iat: number; exp: number };

export function verifyAccessToken(token: string) {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] }) as AccessPayload;
  } catch {
    throw new HttpError(401, "Invalid or expired access token");
  }
}

const sha256 =(value: string) => createHash("sha256").update(value).digest("hex");

async function startSession(userId: string, meta: SessionMeta) {
  const refreshToken = randomBytes(48).toString("base64url");
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TTL_DAYS * 86_400_000);
  const session = await prisma.session.create({
    data: { userId, refreshTokenHash: sha256(refreshToken), ...meta, expiresAt: refreshExpiresAt },
  });
  const accessToken = jwt.sign({ sid: session.id }, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"],
  });
  return { accessToken, refreshToken, refreshExpiresAt };
}

export async function signUp({ password, ...data }: SignUpInput, meta: SessionMeta) {
  const user = await prisma.user.create({
    data: { ...data, passwordHash: await argon2.hash(password, { type: argon2.argon2id }) },
  });
  return { user, ...(await startSession(user.id, meta)) };
}

export async function signIn({ login, password }: SignInInput, meta: SessionMeta) {
  const user = await prisma.user.findFirst({
    where: login.includes("@") ? { email: login.toLowerCase() } : { username: login },
  });
  // Verify even when the user is missing so response time does not reveal which accounts exist.
  const valid = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, password);
  if (!user || !valid) throw new HttpError(401, "Invalid credentials");
  return { user, ...(await startSession(user.id, meta)) };
}

export async function refresh(refreshToken: string, meta: SessionMeta) {
  const session = await prisma.session.findUnique({ where: { refreshTokenHash: sha256(refreshToken) } });
  if (!session || session.expiresAt < new Date()) throw new HttpError(401, "Invalid refresh token");

  if (session.revokedAt) {
    // Rotated token presented again: assume theft, kill every session of this user.
    await prisma.session.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new HttpError(401, "Refresh token reuse detected");
  }

  // Conditional update makes the rotation atomic against concurrent refreshes.
  const { count } = await prisma.session.updateMany({
    where: { id: session.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw new HttpError(401, "Invalid refresh token");

  return startSession(session.userId, meta);
}

export async function logout(refreshToken: string) {
  await prisma.session.updateMany({
    where: { refreshTokenHash: sha256(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
