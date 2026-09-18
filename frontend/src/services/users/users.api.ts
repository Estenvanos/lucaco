import { useMutation, useQuery } from "@tanstack/react-query";
import { ENDPOINTS } from "../../constants/endpoints";
import { request } from "../../lib/api";
import { queryClient } from "../../lib/query-client";
import type { PublicUser, UpdateProfileInput, UserSettings, UserStatus } from "../../types/users.types";
import { serversKeys } from "../servers/servers.keys";
import { usersKeys } from "./users.keys";

export const fetchMe = () => request<PublicUser>(ENDPOINTS.users.me);

export const useMe = () => useQuery({ queryKey: usersKeys.me(), queryFn: fetchMe });

/** Member lists carry everyone's status, so they refetch along with me. */
export const useUpdateStatus = () =>
  useMutation({
    mutationFn: (status: UserStatus) =>
      request<PublicUser>(ENDPOINTS.users.status, { method: "PATCH", body: { status } }),
    onSuccess: (me) => {
      queryClient.setQueryData(usersKeys.me(), me);
      return queryClient.invalidateQueries({ queryKey: serversKeys.all });
    },
  });

const setMe = (me: PublicUser) => queryClient.setQueryData(usersKeys.me(), me);

/** Name changes show up in member lists too. */
export const useUpdateProfile = () =>
  useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      request<PublicUser>(ENDPOINTS.users.me, { method: "PATCH", body: input }),
    onSuccess: (me) => {
      setMe(me);
      return queryClient.invalidateQueries({ queryKey: serversKeys.all });
    },
  });

export const useUpdateAvatar = () =>
  useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append("avatar", file);
      return request<PublicUser>(ENDPOINTS.users.avatar, { method: "PUT", body });
    },
    onSuccess: (me) => {
      setMe(me);
      return queryClient.invalidateQueries({ queryKey: serversKeys.all });
    },
  });

/**
 * Optimistic: a toggle or a theme applies on click. On failure the cache goes back to what the
 * server has.
 */
export const useUpdateSettings = () =>
  useMutation({
    mutationFn: (input: Partial<UserSettings>) =>
      request<PublicUser>(ENDPOINTS.users.settings, { method: "PATCH", body: input }),
    onMutate: (input) =>
      queryClient.setQueryData<PublicUser>(usersKeys.me(), (me) => me && { ...me, settings: { ...me.settings, ...input } }),
    onSuccess: setMe,
    onError: () => queryClient.invalidateQueries({ queryKey: usersKeys.me() }),
  });
