import { Trash2 } from "lucide-react";
import { LIMITS } from "../../constants/limits";
import { useChannelSettings } from "../../hooks/useChannelSettings";
import type { ChannelSettingsFormProps } from "../../types/ui.types";
import { Button } from "../shared/Button";
import { FormError } from "../shared/FormError";
import { ChannelPermissions } from "./ChannelPermissions";

export function ChannelSettingsForm(props: ChannelSettingsFormProps) {
  const { channel, type, roles, members, canManageChannel, canManagePermissions } = props;
  const settings = useChannelSettings(props);
  const tabs = [
    { id: "overview" as const, label: "Visão geral" },
    ...(canManagePermissions ? [{ id: "permissions" as const, label: "Permissões" }] : []),
  ];

  return (
    <div className="channel-settings">
      {/* Same top tabs as the user settings. */}
      <nav className="discover-tabs channel-settings-tabs" aria-label="Configurações do canal">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-current={settings.tab === tab.id}
            onClick={() => settings.setTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="channel-settings-body">
        {settings.tab === "overview" ? (
          <div className="settings-form">
            <label className="field">
              <span>Nome do canal</span>
              <div className="field-control">
                <input
                  value={settings.name}
                  maxLength={LIMITS.channelName.max}
                  placeholder="novo-canal"
                  aria-invalid={Boolean(settings.nameError)}
                  disabled={!canManageChannel}
                  autoFocus
                  onChange={(event) => settings.setName(event.target.value)}
                />
              </div>
              <FormError message={settings.nameError} />
            </label>
            {type === "text" && (
              <label className="field">
                <span>Tópico</span>
                <textarea
                  value={settings.topic}
                  maxLength={LIMITS.channelTopic.max}
                  rows={3}
                  placeholder="Sobre o que é este canal"
                  disabled={!canManageChannel}
                  onChange={(event) => settings.setTopic(event.target.value)}
                />
              </label>
            )}
            {channel && type === "text" && canManageChannel && (
              <button
                type="button"
                className="channel-settings-delete"
                disabled={settings.deleting}
                onClick={settings.deleteChannel}
              >
                Excluir canal <Trash2 aria-hidden />
              </button>
            )}
          </div>
        ) : (
          <ChannelPermissions
            type={type}
            roles={roles}
            members={members}
            isPrivate={settings.isPrivate}
            onTogglePrivate={settings.togglePrivate}
            targets={settings.targets}
            selected={settings.selected}
            onSelect={settings.select}
            onAdd={settings.addTarget}
            onRemove={settings.removeTarget}
            stateOf={settings.stateOf}
            onChange={settings.setState}
          />
        )}
      </div>

      <footer className="settings-actions channel-settings-footer">
        <FormError message={settings.error} />
        <Button type="button" className="button-ghost" onClick={props.onClose}>
          Cancelar
        </Button>
        <Button type="button" loading={settings.saving} onClick={settings.save}>
          {channel ? "Salvar alterações" : "Criar canal"}
        </Button>
      </footer>
    </div>
  );
}
