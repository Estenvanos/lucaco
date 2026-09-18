import { useParams } from "react-router";
import { useServers } from "../../services/servers/servers.api";

export function ServerPage() {
  const { serverId } = useParams();
  const { data: servers = [] } = useServers();
  const server = servers.find((s) => s.id === serverId);

  return (
    <section className="card">
      <h2>{server?.name ?? "Server"}</h2>
      <p>Canais de texto e o canal de voz entram aqui.</p>
    </section>
  );
}
