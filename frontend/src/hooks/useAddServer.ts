import { useState } from "react";
import { createServerSchema, joinServerSchema } from "../schemas/servers.schema";
import { useCreateServer, useJoinServer } from "../services/servers/servers.api";
import type { AddServerTab } from "../types/ui.types";
import { useZodForm } from "./useZodForm";

/** The two ways into a server: make one, or join one by id. Both close the dialog on success. */
export function useAddServer(onDone: (serverId: string) => void) {
  const [tab, setTab] = useState<AddServerTab>("create");
  const create = useCreateServer();
  const join = useJoinServer();

  const createForm = useZodForm(createServerSchema, async (values) => {
    const server = await create.mutateAsync(values);
    onDone(server.id);
  });

  const joinForm = useZodForm(joinServerSchema, async (values) => {
    const member = await join.mutateAsync(values);
    onDone(member.serverId);
  });

  return {
    tab,
    setTab,
    createForm: { ...createForm, loading: create.isPending },
    joinForm: { ...joinForm, loading: join.isPending },
  };
}
