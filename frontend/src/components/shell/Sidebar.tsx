import { useSidebar } from "../../hooks/useSidebar";
import { AddServerDialog } from "../servers/AddServerDialog";
import { ServerWheel } from "./ServerWheel";
import { UserMenu } from "./UserMenu";

export function Sidebar() {
  const { servers, activeServerId, query, onQueryChange, adding, openAdd, closeAdd, openServer } =
    useSidebar();

  return (
    <nav className="sidebar" aria-label="Navegação principal">
      <img className="sidebar-logo" src="/images/logo_pequena.jpg" alt="Lucaco" />

      <label className="sidebar-search">
        <input
          type="search"
          value={query}
          onChange={onQueryChange}
          placeholder="serv"
          aria-label="Buscar servers"
        />
      </label>

      <ServerWheel
        servers={servers}
        activeServerId={activeServerId}
        onOpenServer={openServer}
        onAdd={openAdd}
      />

      <UserMenu />

      {adding && (
        <AddServerDialog
          onClose={closeAdd}
          onDone={(serverId) => {
            closeAdd();
            openServer(serverId);
          }}
        />
      )}
    </nav>
  );
}
