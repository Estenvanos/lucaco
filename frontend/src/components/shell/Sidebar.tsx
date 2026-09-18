import { useSidebar } from "../../hooks/useSidebar";
import { SearchServersDialog } from "../servers/SearchServersDialog";
import { ServerWheel } from "./ServerWheel";
import { UserMenu } from "./UserMenu";

export function Sidebar() {
  const { servers, activeServerId, openDiscover, openServer, searchOrigin, openSearch, closeSearch } = useSidebar();

  return (
    <nav className="sidebar" aria-label="Navegação principal">
      <img className="sidebar-logo" src="/images/logo_pequena.jpg" alt="Lucaco" />

      <button type="button" className="sidebar-search" onClick={openSearch} title="Buscar servers">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="sr-only">Buscar servers</span>
      </button>

      <ServerWheel
        servers={servers}
        activeServerId={activeServerId}
        onOpenServer={openServer}
        onAdd={openDiscover}
      />

      <UserMenu />

      {searchOrigin && (
        <SearchServersDialog
          origin={searchOrigin}
          onClose={closeSearch}
          onPick={(serverId) => {
            closeSearch();
            openServer(serverId);
          }}
        />
      )}
    </nav>
  );
}
