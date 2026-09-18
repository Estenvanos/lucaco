import { useSidebar } from "../../hooks/useSidebar";
import { SearchFriendsDialog } from "../friends/SearchFriendsDialog";
import { SearchServersDialog } from "../servers/SearchServersDialog";
import { ModeSwitch } from "./ModeSwitch";
import { ServerWheel } from "./ServerWheel";
import { UserMenu } from "./UserMenu";

export function Sidebar() {
  const sidebar = useSidebar();
  const { mode, toggleMode, entries, activeId, openEntry } = sidebar;
  const { openDiscover, openFriends, openServer } = sidebar;
  const { searchOrigin, openSearch, closeSearch } = sidebar;

  return (
    <nav className="sidebar" aria-label="Navegação principal">
      <img className="sidebar-logo" src="/images/logo_pequena.jpg" alt="Lucaco" />

      <button type="button" className="sidebar-search" onClick={openSearch} title={mode === "servers" ? "Buscar servers" : "Buscar amigos"}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="sr-only">{mode === "servers" ? "Buscar servers" : "Buscar amigos"}</span>
      </button>

      <ModeSwitch mode={mode} onToggle={toggleMode} />

      {/* key: each mode gets a fresh wheel, so the offset never carries over between lists. */}
      <ServerWheel
        key={mode}
        servers={entries}
        userMenus={mode === "friends"}
        activeServerId={activeId}
        onOpenServer={openEntry}
        onAdd={mode === "servers" ? openDiscover : openFriends}
      />

      <UserMenu />

      {searchOrigin && mode === "friends" && (
        <SearchFriendsDialog
          origin={searchOrigin}
          onClose={closeSearch}
          onPick={(userId) => {
            closeSearch();
            openEntry(userId);
          }}
        />
      )}

      {searchOrigin && mode === "servers" && (
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
