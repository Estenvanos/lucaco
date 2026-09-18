import { DiscoverNav } from "../../components/discover/DiscoverNav";
import { FormError } from "../../components/shared/FormError";
import { ServerCard } from "../../components/shared/ServerCard";
import { JoinServerDialog } from "../../components/servers/JoinServerDialog";
import { useDiscover } from "../../hooks/useDiscover";

export function DiscoverPage() {
  const discover = useDiscover();
  const { category, servers, isFetching, isError, value } = discover;

  return (
    <div className="discover">
      <DiscoverNav
        active={category?.value ?? null}
        onPick={discover.pickCategory}
        search={value}
        onSearch={discover.onSearch}
        onCreate={discover.create}
        onJoin={discover.openJoin}
      />

      <section className="discover-section" aria-busy={isFetching}>
        <h2>{category?.label ?? "Servidores públicos"}</h2>
        <FormError message={discover.joinError} />

        <ul className="discover-grid">
          {servers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              joining={discover.joiningId === server.id}
              onOpen={discover.openServer}
            />
          ))}
        </ul>

        {!isFetching && servers.length === 0 && (
          <p className="discover-empty">
            {isError
              ? "Não foi possível carregar os servers."
              : value.trim()
                ? "Nenhum server público com esse nome."
                : "Nenhum server público nessa categoria ainda."}
          </p>
        )}
      </section>

      {discover.joining && <JoinServerDialog onClose={discover.closeJoin} onDone={discover.onJoined} />}
    </div>
  );
}
