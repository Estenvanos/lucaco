import { useMutation, useQuery } from "@tanstack/react-query";
import { ENDPOINTS } from "../../constants/endpoints";
import { request } from "../../lib/api";
import { queryClient } from "../../lib/query-client";
import type { ServerRule } from "../../types/rules.types";
import { rulesKeys } from "./rules.keys";

export const useRules = (serverId: string) =>
  useQuery({
    queryKey: rulesKeys.list(serverId),
    queryFn: () => request<ServerRule[]>(ENDPOINTS.servers.rules(serverId)),
  });

/** The whole ordered list replaces the saved one. */
export const useSaveRules = (serverId: string) =>
  useMutation({
    mutationFn: (rules: string[]) =>
      request<ServerRule[]>(ENDPOINTS.servers.rules(serverId), { method: "PUT", body: { rules } }),
    onSuccess: (saved) => queryClient.setQueryData(rulesKeys.list(serverId), saved),
  });
