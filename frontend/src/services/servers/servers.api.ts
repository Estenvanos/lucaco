import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ENDPOINTS } from "../../constants/endpoints";
import { request } from "../../lib/api";
import { queryClient } from "../../lib/query-client";
import type { CreateServerInput, JoinServerInput, PublicServer } from "../../types/servers.types";
import { serversKeys } from "./servers.keys";

export const useServers = () =>
  useQuery({
    queryKey: serversKeys.list(),
    queryFn: () => request<PublicServer[]>(ENDPOINTS.servers.root),
  });

const invalidateList = () => queryClient.invalidateQueries({ queryKey: serversKeys.list() });

export const useCreateServer = () =>
  useMutation({
    mutationFn: (input: CreateServerInput) =>
      request<PublicServer>(ENDPOINTS.servers.root, { method: "POST", body: input }),
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
