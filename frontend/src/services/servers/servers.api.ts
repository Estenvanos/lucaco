import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ENDPOINTS } from "../../constants/endpoints";
import { request } from "../../lib/api";
import { queryClient } from "../../lib/query-client";
import type {
  CreateServerInput,
  DiscoveredServer,
  JoinServerInput,
  PublicServer,
  ServerImageKind,
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
