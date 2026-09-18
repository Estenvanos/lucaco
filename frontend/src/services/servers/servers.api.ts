import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ENDPOINTS } from "../../constants/endpoints";
import { request } from "../../lib/api";
import { queryClient } from "../../lib/query-client";
import type {
  Channel,
  ChannelFormValues,
  ChannelOverwrites,
  CreateChannelInput,
  Overwrite,
  OverwriteTarget,
  PermissionName,
  Role,
  CreateServerInput,
  DiscoveredServer,
  JoinServerInput,
  PublicServer,
  ServerImageKind,
  ServerMember,
} from "../../types/servers.types";
import { serversKeys } from "./servers.keys";

export const useServers = () =>
  useQuery({
    queryKey: serversKeys.list(),
    queryFn: () => request<PublicServer[]>(ENDPOINTS.servers.root),
  });

/** Keeps the previous results on screen while the next query loads, so the list never blinks. */
export const useSearchServers = (query: string) =>
  useQuery({
    queryKey: serversKeys.search(query),
    queryFn: () => request<PublicServer[]>(ENDPOINTS.servers.search(query)),
    placeholderData: keepPreviousData,
  });

export const useDiscoverServers = (query: string, category: string | null) =>
  useQuery({
    queryKey: serversKeys.discover(query, category),
    queryFn: () => request<DiscoveredServer[]>(ENDPOINTS.servers.discover(query, category)),
    placeholderData: keepPreviousData,
  });

// Every list shape (plain and search results) changes when a server is created or joined.
const invalidateList = () => queryClient.invalidateQueries({ queryKey: serversKeys.all });

export const useCreateServer = () =>
  useMutation({
    mutationFn: (input: CreateServerInput) =>
      request<PublicServer>(ENDPOINTS.servers.root, { method: "POST", body: input }),
    onSuccess: invalidateList,
  });

/** Icon or banner upload: the multipart field name matches the kind, like the API expects. */
export const useUpdateServerImage = () =>
  useMutation({
    mutationFn: ({ serverId, kind, file }: { serverId: string; kind: ServerImageKind; file: File }) => {
      const body = new FormData();
      body.append(kind, file);
      return request<PublicServer>(ENDPOINTS.servers.image(serverId, kind), { method: "PUT", body });
    },
    onSuccess: invalidateList,
  });

export const useJoinServer = () =>
  useMutation({
    mutationFn: ({ reference }: JoinServerInput) => {
      const endpoint = z.uuid().safeParse(reference).success
        ? ENDPOINTS.servers.members(reference)
        : ENDPOINTS.servers.acceptInvite(reference);
      return request<{ serverId: string }>(endpoint, { method: "POST" });
    },
    onSuccess: invalidateList,
  });

export const useChannels = (serverId: string) =>
  useQuery({
    queryKey: serversKeys.channels(serverId),
    queryFn: () => request<Channel[]>(ENDPOINTS.servers.channels(serverId)),
  });

export const useMembers = (serverId: string) =>
  useQuery({
    queryKey: serversKeys.members(serverId),
    queryFn: () => request<ServerMember[]>(ENDPOINTS.servers.members(serverId)),
  });

export const useRoles = (serverId: string) =>
  useQuery({
    queryKey: serversKeys.roles(serverId),
    queryFn: () => request<Role[]>(ENDPOINTS.servers.roles(serverId)),
  });

/** What the current user holds server-wide (ADMINISTRATOR already expanded to everything). */
export const useServerPermissions = (serverId: string) =>
  useQuery({
    queryKey: serversKeys.permissions(serverId),
    queryFn: () => request<{ permissions: PermissionName[] }>(ENDPOINTS.servers.permissions(serverId)),
    select: (data) => data.permissions,
    enabled: Boolean(serverId),
  });

const invalidateMembers = (serverId: string) =>
  queryClient.invalidateQueries({ queryKey: serversKeys.members(serverId) });

/** Removes the member; they can join again. */
export const useKickMember = (serverId: string) =>
  useMutation({
    mutationFn: (userId: string) => request(ENDPOINTS.servers.member(serverId, userId), { method: "DELETE" }),
    onSuccess: () => invalidateMembers(serverId),
  });

/** Removes the member for good. */
export const useBanMember = (serverId: string) =>
  useMutation({
    mutationFn: (userId: string) => request(ENDPOINTS.servers.ban(serverId, userId), { method: "PUT" }),
    onSuccess: () => invalidateMembers(serverId),
  });

/** Owner only: grants or drops the auto-created "Admin" role. */
export const useSetAdmin = (serverId: string) =>
  useMutation({
    mutationFn: ({ memberId, admin }: { memberId: string; admin: boolean }) =>
      request(ENDPOINTS.servers.admin(serverId, memberId), { method: admin ? "PUT" : "DELETE" }),
    onSuccess: () =>
      Promise.all([
        invalidateMembers(serverId),
        queryClient.invalidateQueries({ queryKey: serversKeys.roles(serverId) }),
      ]),
  });

export const useChannelPermissions = (channelId: string | null) =>
  useQuery({
    queryKey: serversKeys.channelPermissions(channelId ?? ""),
    queryFn: () => request<ChannelOverwrites>(ENDPOINTS.channels.permissions(channelId!)),
    enabled: Boolean(channelId),
  });

// Channels carry the caller's resolved permissions, so any overwrite change reshapes the list.
const invalidateChannels = (serverId: string) =>
  queryClient.invalidateQueries({ queryKey: serversKeys.channels(serverId) });

/** A new channel and its overwrites travel in one request: the API stores them in one transaction. */
export const useCreateChannel = (serverId: string) =>
  useMutation({
    mutationFn: (input: CreateChannelInput) =>
      request<Channel>(ENDPOINTS.servers.channels(serverId), { method: "POST", body: input }),
    onSuccess: () => invalidateChannels(serverId),
  });

export const useUpdateChannel = (serverId: string, channelId: string) =>
  useMutation({
    mutationFn: (input: ChannelFormValues) =>
      request<Channel>(ENDPOINTS.channels.detail(channelId), { method: "PATCH", body: input }),
    onSuccess: () => invalidateChannels(serverId),
  });

export const useDeleteChannel = (serverId: string, channelId: string) =>
  useMutation({
    mutationFn: () => request(ENDPOINTS.channels.detail(channelId), { method: "DELETE" }),
    onSuccess: () => invalidateChannels(serverId),
  });

/** Writes the changed overwrites one by one; `allow` and `deny` both empty removes one. */
export const useSaveChannelPermissions = (serverId: string, channelId: string) =>
  useMutation({
    mutationFn: async (changes: { target: OverwriteTarget; overwrite: Overwrite }[]) => {
      for (const { target, overwrite } of changes) {
        const endpoint =
          target.kind === "role"
            ? ENDPOINTS.channels.rolePermission(channelId, target.id)
            : ENDPOINTS.channels.memberPermission(channelId, target.id);
        await request(endpoint, { method: "PUT", body: overwrite });
      }
    },
    onSettled: () => {
      invalidateChannels(serverId);
      queryClient.invalidateQueries({ queryKey: serversKeys.channelPermissions(channelId) });
    },
  });
