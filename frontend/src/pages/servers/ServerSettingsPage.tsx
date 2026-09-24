import { ServerAuditSection } from "../../components/server-settings/ServerAuditSection";
import { ServerMembersSection } from "../../components/server-settings/ServerMembersSection";
import { ServerProfileSection } from "../../components/server-settings/ServerProfileSection";
import { ServerRulesSection } from "../../components/server-settings/ServerRulesSection";
import { SettingsNav } from "../../components/settings/SettingsNav";
import { ROUTES } from "../../constants/routes";
import { useServerSettings } from "../../hooks/useServerSettings";

const SECTIONS = {
  perfil: ServerProfileSection,
  regras: ServerRulesSection,
  membros: ServerMembersSection,
  auditoria: ServerAuditSection,
};

export function ServerSettingsPage() {
  const { server, permissions, sections, active, loading } = useServerSettings();

  if (loading) return <p className="settings-panel settings-hint">Carregando...</p>;
  if (!server || !active) {
    return <p className="settings-panel settings-hint">Você não tem permissão para configurar este server.</p>;
  }

  const Section = SECTIONS[active];
  return (
    <div className="discover">
      <SettingsNav
        label={`Configurações de ${server.name}`}
        sections={sections}
        active={active}
        hrefFor={(section) => ROUTES.serverSettings(server.id, section)}
      />
      <section className="settings-panel">
        <Section key={server.id} server={server} permissions={permissions} />
      </section>
    </div>
  );
}
