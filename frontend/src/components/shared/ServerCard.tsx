import type { ServerCardProps } from "../../types/ui.types";
import { ServerAvatar } from "../servers/ServerAvatar";

export function ServerCard({ server, joining, onOpen }: ServerCardProps) {
  return (
    <li>
      <button type="button" className="discover-card" onClick={() => onOpen(server.id)} aria-busy={joining}>
        {/* The banner when there is one; otherwise the icon, blurred, stands in for it. */}
        <span
          className="discover-card-banner"
          data-fallback={!server.bannerUrl}
          style={
            server.bannerUrl || server.iconUrl
              ? { backgroundImage: `url(${server.bannerUrl ?? server.iconUrl})` }
              : undefined
          }
          aria-hidden
        />
        <span className="discover-card-icon">
          <ServerAvatar server={server} />
        </span>
        <span className="discover-card-body">
          <strong>{server.name}</strong>
          <span className="discover-card-description">{server.description ?? "Sem descrição."}</span>
          {server.memberCount !== undefined && (
            <span className="discover-card-members">
              {server.memberCount.toLocaleString("pt-BR")} {server.memberCount === 1 ? "membro" : "membros"}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
