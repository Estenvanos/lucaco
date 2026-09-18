import { useNotificationsPanel } from "../../hooks/useNotificationsPanel";
import { NotificationsPanel } from "../notifications/NotificationsPanel";

/** App-wide bar above every logged-in page. Actions sit on the right; more will join them. */
export function TopBar() {
  const panel = useNotificationsPanel();
  // Muted: the bell stays usable, just without the counter.
  const count = panel.muted ? 0 : panel.notifications.length;

  return (
    <header className="top-bar">
      <div className="top-bar-actions">
        <button
          type="button"
          className="top-bar-button"
          aria-expanded={panel.open}
          title="Notificações"
          onClick={panel.toggle}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {count > 0 && <span className="top-bar-badge">{count}</span>}
          <span className="sr-only">Notificações{count > 0 ? ` (${count})` : ""}</span>
        </button>
      </div>

      {panel.open && (
        <NotificationsPanel
          notifications={panel.notifications}
          busy={panel.busy}
          onClose={panel.close}
          onOpen={panel.onOpen}
          onDismiss={panel.onDismiss}
        />
      )}
    </header>
  );
}
