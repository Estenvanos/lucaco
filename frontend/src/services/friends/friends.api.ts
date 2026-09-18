import { useMutation, useQuery } from "@tanstack/react-query";
import { ENDPOINTS } from "../../constants/endpoints";
import { request } from "../../lib/api";
import { queryClient } from "../../lib/query-client";
import type { AddFriendInput, PublicFriendship } from "../../types/friends.types";
import { notificationsKeys } from "../notifications/notifications.keys";
import { friendsKeys } from "./friends.keys";

/** Accepted friendships only: the API defaults `status` to accepted. */
export const useFriends = (enabled = true) =>
  useQuery({
    queryKey: friendsKeys.list(),
    queryFn: () => request<PublicFriendship[]>(ENDPOINTS.friends.root),
    enabled,
  });

/** Requests I sent that are still waiting: pending rows minus the ones sent to me. */
export const useSentRequests = () =>
  useQuery({
    queryKey: friendsKeys.sent(),
    queryFn: () => request<PublicFriendship[]>(ENDPOINTS.friends.pending),
    select: (rows) => rows.filter((f) => !f.incoming),
  });

// Answering a request changes both the friend list and the notification it came from.
const invalidate = () =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: friendsKeys.all }),
    queryClient.invalidateQueries({ queryKey: notificationsKeys.all }),
  ]);

export const useSendFriendRequest = () =>
  useMutation({
    mutationFn: ({ username, message }: AddFriendInput) =>
      request<PublicFriendship>(ENDPOINTS.friends.root, {
        method: "POST",
        body: { username, message: message || undefined },
      }),
    onSuccess: invalidate,
  });

export const useAcceptFriend = () =>
  useMutation({
    mutationFn: (userId: string) =>
      request<PublicFriendship>(ENDPOINTS.friends.accept(userId), { method: "POST" }),
    onSuccess: invalidate,
  });

/** Declining drops the pending row, same endpoint as unfriending. */
export const useDeclineFriend = () =>
  useMutation({
    mutationFn: (userId: string) => request(ENDPOINTS.friends.detail(userId), { method: "DELETE" }),
    onSuccess: invalidate,
  });
