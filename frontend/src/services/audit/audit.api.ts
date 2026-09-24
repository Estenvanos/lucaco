import { useInfiniteQuery } from "@tanstack/react-query";
import { ENDPOINTS } from "../../constants/endpoints";
import { request } from "../../lib/api";
import type { AuditAction, AuditPage } from "../../types/audit.types";
import { auditKeys } from "./audit.keys";

/** Newest first; `fetchNextPage` walks back in time. Always refetched on open: it is a log. */
export const useAuditLog = (serverId: string, action: AuditAction | null) =>
  useInfiniteQuery({
    queryKey: auditKeys.list(serverId, action),
    queryFn: ({ pageParam }) => request<AuditPage>(ENDPOINTS.servers.auditLog(serverId, pageParam, action)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchOnMount: "always",
  });
