import type { Notification, NotificationTag } from "../../generated/prisma/client.js";
import { NOTIFICATION_TAGS, SOCKET_EVENTS } from "../../lib/constants.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { emitToUser } from "../../lib/socket.js";
import * as usersService from "../users/users.services.js";

type NewNotification = {
  tag: NotificationTag;
  title: string;
  subtitle?: string;
  ownerId: string;
  receiverId: string;
  /** Where a mention lives, so the bell can open the channel. */
  serverId?: string;
  channelId?: string;
};

/** The owner goes out as a public profile (no email), so the inbox can show who it came from. */
async function toPublic(notifications: Notification[]) {
  const profiles = await usersService.getProfiles([...new Set(notifications.map((n) => n.ownerId))]);
  return notifications.map((n) => ({
    id: n.id,
    tag: n.tag,
    title: n.title,
    subtitle: n.subtitle,
    serverId: n.serverId,
    channelId: n.channelId,
    createdAt: n.createdAt,
    owner: profiles.get(n.ownerId)!,
  }));
}

/**
 * Stores the notification and pushes it to the receiver's open tabs. Dropped when the receiver
 * muted the owner: every notice goes through here, so that covers DMs and friend requests.
 */
export async function notify(input: NewNotification) {
  if (await usersService.isMuted(input.receiverId, input.ownerId)) return null;
  const notification = await prisma.notification.create({ data: input });
  const [payload] = await toPublic([notification]);
  emitToUser(input.receiverId, SOCKET_EVENTS.notificationNew, payload);
  return payload;
}

/** Like notify, but a no-op while the same kind of notice from the same owner is still unread. */
export async function notifyOnce(input: NewNotification) {
  const { tag, ownerId, receiverId } = input;
  const existing = await prisma.notification.findFirst({ where: { tag, ownerId, receiverId } });
  if (!existing) await notify(input);
}

/** Clears every notice of one kind the owner left for the receiver (opening a chat reads it). */
export async function dismissFrom(receiverId: string, ownerId: string, tag: NotificationTag) {
  const found = await prisma.notification.findMany({ where: { tag, ownerId, receiverId } });
  if (found.length === 0) return;
  await prisma.notification.deleteMany({ where: { id: { in: found.map((n) => n.id) } } });
  for (const n of found) emitToUser(receiverId, SOCKET_EVENTS.notificationRemoved, { id: n.id });
}

export async function list(receiverId: string) {
  const notifications = await prisma.notification.findMany({
    where: { receiverId },
    orderBy: { createdAt: "desc" },
  });
  return toPublic(notifications);
}

/** Clears the pending friend request between the pair, whichever side sent it. */
export async function dismissFriendRequest(a: string, b: string) {
  const pending = await prisma.notification.findMany({
    where: {
      tag: NOTIFICATION_TAGS.friendRequest,
      OR: [
        { ownerId: a, receiverId: b },
        { ownerId: b, receiverId: a },
      ],
    },
  });
  if (pending.length === 0) return;
  await prisma.notification.deleteMany({ where: { id: { in: pending.map((n) => n.id) } } });
  for (const n of pending) emitToUser(n.receiverId, SOCKET_EVENTS.notificationRemoved, { id: n.id });
}

/**
 * The X on a plain notification. A friend request is not dismissed here: it is answered in
 * /friends, or the pending friendship would outlive its only notice.
 */
export async function remove(receiverId: string, id: string) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  // Someone else's notification is a 404 too: no hint that the id exists.
  if (!notification || notification.receiverId !== receiverId) {
    throw new HttpError(404, "Notification not found");
  }
  if (notification.tag === NOTIFICATION_TAGS.friendRequest) {
    throw new HttpError(409, "Accept or decline the friend request instead");
  }
  await prisma.notification.delete({ where: { id } });
  emitToUser(receiverId, SOCKET_EVENTS.notificationRemoved, { id });
}
