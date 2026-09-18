import { initials } from "../../lib/utils";
import type { ServerAvatarProps } from "../../types/ui.types";

export function ServerAvatar({ server }: ServerAvatarProps) {
  if (server.iconUrl) return <img src={server.iconUrl} alt="" />;
  return <span className="server-initials">{initials(server.name)}</span>;
}
