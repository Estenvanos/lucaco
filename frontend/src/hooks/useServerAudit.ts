import { useState } from "react";
import { useAuditLog } from "../services/audit/audit.api";
import type { AuditAction } from "../types/audit.types";

export function useServerAudit(serverId: string) {
  const [action, setAction] = useState<AuditAction | null>(null);
  const log = useAuditLog(serverId, action);

  return {
    action,
    setAction,
    entries: log.data?.pages.flatMap((page) => page.entries) ?? [],
    loading: log.isPending,
    error: log.error?.message ?? null,
    hasMore: log.hasNextPage,
    loadingMore: log.isFetchingNextPage,
    loadMore: () => log.fetchNextPage(),
  };
}
