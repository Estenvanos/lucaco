import { useMutation, useQuery } from "@tanstack/react-query";
import { ENDPOINTS } from "../../constants/endpoints";
import { request } from "../../lib/api";
import { queryClient } from "../../lib/query-client";
import type { AppNotification } from "../../types/notifications.types";
import { notificationsKeys } from "./notifications.keys";

/** Loaded once over HTTP; after that the socket keeps the cache current (notifications.socket.ts). */
export const useNotifications = (filter?: (notification: AppNotification) => boolean) =>
  useQuery({
    queryKey: notificationsKeys.list(),
    queryFn: () => request<AppNotification[]>(ENDPOINTS.notifications.root),
    staleTime: Infinity,
    // One cached list, two views: the friends inbox and the top bar panel each take their part.
    select: filter && ((list: AppNotification[]) => list.filter(filter)),
  });

export const useDismissNotification = () =>
  useMutation({
    mutationFn: (id: string) => request(ENDPOINTS.notifications.detail(id), { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKeys.all }),
  });
