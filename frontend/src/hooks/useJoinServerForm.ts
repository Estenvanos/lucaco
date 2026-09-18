import { joinServerSchema } from "../schemas/servers.schema";
import { useJoinServer } from "../services/servers/servers.api";
import { useZodForm } from "./useZodForm";

/** Join a server by public id or invite code; closes the dialog on success. */
export function useJoinServerForm(onDone: (serverId: string) => void) {
  const join = useJoinServer();

  const form = useZodForm(joinServerSchema, async (values) => {
    const member = await join.mutateAsync(values);
    onDone(member.serverId);
  });

  return { ...form, loading: join.isPending };
}
