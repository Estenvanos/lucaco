import type { HomeServersProps } from "../../types/ui.types";
import { ServerCard } from "../shared/ServerCard";

export function HomeServers({ servers, onOpen, onDiscover, onCreate }: HomeServersProps) {
  if (servers.length === 0) {
    return (
      <div className="home-empty">
        <p className="discover-empty">Você ainda não está em nenhum server.</p>
        <button type="button" className="button button-ghost" onClick={onDiscover}>
          Descobrir servers
        </button>
        <button type="button" className="button" onClick={onCreate}>
          Criar server
        </button>
      </div>
    );
  }

  return (
    <ul className="discover-grid">
      {servers.map((server) => (
        <ServerCard key={server.id} server={server} joining={false} onOpen={onOpen} />
      ))}
    </ul>
  );
}
