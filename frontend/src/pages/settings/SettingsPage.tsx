import { AccountSection } from "../../components/settings/AccountSection";
import { AppearanceSection } from "../../components/settings/AppearanceSection";
import { AudioSection } from "../../components/settings/AudioSection";
import { NotificationsSection } from "../../components/settings/NotificationsSection";
import { ProfileSection } from "../../components/settings/ProfileSection";
import { SettingsNav } from "../../components/settings/SettingsNav";
import { useSettingsSection } from "../../hooks/useSettingsSection";

const SECTIONS = {
  perfil: <ProfileSection />,
  conta: <AccountSection />,
  aparencia: <AppearanceSection />,
  notificacoes: <NotificationsSection />,
  audio: <AudioSection />,
};

export function SettingsPage() {
  const section = useSettingsSection();

  return (
    <div className="discover">
      <SettingsNav active={section} />
      <section className="settings-panel">{SECTIONS[section]}</section>
    </div>
  );
}
