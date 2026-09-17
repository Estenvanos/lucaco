import type { Friendship } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import * as usersService from "../users/users.services.js";
import type { ListFriendsInput } from "./friends.schema.js";

/** The table stores one row per pair in canonical order, so both directions map to the same key. */
export function canonicalPair(a: string, b: string) {
  return a < b ? { userLowId: a, userHighId: b } : { userLowId: b, userHighId: a };
}

const otherId = (friendship: Friendship, userId: string) =>
  friendship.userLowId === userId ? friendship.userHighId : friendship.userLowId;

export function toPublicFriendship(friendship: Friendship, userId: string) {
  return {
    id: friendship.id,
    userId: otherId(friendship, userId),
    status: friendship.status,
    incoming: friendship.requestedBy !== userId,
    blockedByMe: friendship.blockedBy === userId,
    createdAt: friendship.createdAt,
    respondedAt: friendship.respondedAt,
  };
}

function find(a: string, b: string) {
  return prisma.friendship.findUnique({ where: { userLowId_userHighId: canonicalPair(a, b) } });
}

/** Used by other modules (DMs) instead of reading the friendships table directly. */
export async function areFriends(a: string, b: string) {
  if (a === b) return false;
  const friendship = await find(a, b);
  return friendship?.status === "accepted";
}

export async function list(userId: string, { status }: ListFriendsInput) {
  const friendships = await prisma.friendship.findMany({
    where: { status, OR: [{ userLowId: userId }, { userHighId: userId }] },
    orderBy: { createdAt: "desc" },
  });
  return friendships.map((f) => toPublicFriendship(f, userId));
}

/**
 * Sending a request to someone who already invited you accepts it instead of creating a
 * second row — the unique pair makes any other outcome an error anyway.
 */
export async function request(userId: string, targetId: string) {
  if (userId === targetId) throw new HttpError(409, "You cannot add yourself");
  await usersService.getById(targetId);

  const existing = await find(userId, targetId);
  if (existing?.status === "blocked") throw new HttpError(403, "This user is blocked");
  if (existing?.status === "accepted") throw new HttpError(409, "You are already friends");
  if (existing?.requestedBy === userId) throw new HttpError(409, "Request already sent");
  if (existing) return accept(userId, targetId);

  const friendship = await prisma.friendship.create({
    data: { ...canonicalPair(userId, targetId), requestedBy: userId },
  });
  return toPublicFriendship(friendship, userId);
}

/** Only the invited side can accept: accepting your own request would make anyone a friend. */
export async function accept(userId: string, targetId: string) {
  const existing = await find(userId, targetId);
  if (!existing || existing.status !== "pending") throw new HttpError(404, "No pending request");
  if (existing.requestedBy === userId) throw new HttpError(403, "Wait for the other side to accept");

  const friendship = await prisma.friendship.update({
    where: { id: existing.id },
    data: { status: "accepted", respondedAt: new Date() },
  });
  return toPublicFriendship(friendship, userId);
}

/** Declines a request, or removes an existing friend: both drop the row. */
export async function remove(userId: string, targetId: string) {
  const existing = await find(userId, targetId);
  if (!existing) throw new HttpError(404, "Friendship not found");
  if (existing.status === "blocked" && existing.blockedBy !== userId) {
    throw new HttpError(403, "This user is blocked");
  }
  await prisma.friendship.delete({ where: { id: existing.id } });
}

export async function block(userId: string, targetId: string) {
  if (userId === targetId) throw new HttpError(409, "You cannot block yourself");
  await usersService.getById(targetId);
  const pair = canonicalPair(userId, targetId);
  const friendship = await prisma.friendship.upsert({
    where: { userLowId_userHighId: pair },
    create: { ...pair, requestedBy: userId, status: "blocked", blockedBy: userId },
    update: { status: "blocked", blockedBy: userId, respondedAt: new Date() },
  });
  return toPublicFriendship(friendship, userId);
}

export async function unblock(userId: string, targetId: string) {
  const existing = await find(userId, targetId);
  if (!existing || existing.status !== "blocked") throw new HttpError(404, "User is not blocked");
  if (existing.blockedBy !== userId) throw new HttpError(403, "Only the blocker can unblock");
  await prisma.friendship.delete({ where: { id: existing.id } });
}
