import { NOTIFICATION_TAG_LABEL } from "../../constants/settings";
import { useUserSettings } from "../../hooks/useUserSettings";
import type { NotificationTag } from "../../types/notifications.types";

export function NotificationsSection() {
  const { settings, save } = useUserSettings();
  const hidden = settings.hiddenNotificationTags;

  const toggleTag = (tag: NotificationTag, show: boolean) =>
    save({ hiddenNotificationTags: show ? hidden.filter((t) => t !== tag) : [...hidden, tag] });

  return (
    <div className="settings-form">
      <h2>Notificações</h2>
      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={settings.notificationsMuted}
          onChange={(event) => save({ notificationsMuted: event.target.checked })}
        />
        <span>
          <strong>Silenciar</strong>
          <small>O sino para de mostrar o contador. As notificações continuam chegando.</small>
        </span>
      </label>

      <fieldset className="settings-choices">
        <legend>Mostrar no sino</legend>
        {Object.entries(NOTIFICATION_TAG_LABEL).map(([tag, label]) => (
          <label key={tag}>
            <input
              type="checkbox"
              checked={!hidden.includes(tag as NotificationTag)}
              onChange={(event) => toggleTag(tag as NotificationTag, event.target.checked)}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
