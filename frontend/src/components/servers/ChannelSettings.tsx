import { Modal } from "../shared/Modal";
import { useAuth } from "../../hooks/useAuth";
import { useChannelPermissions, useRoles, useServerPermissions } from "../../services/servers/servers.api";
import type { ChannelSettingsProps } from "../../types/ui.types";
import { ChannelSettingsForm } from "./ChannelSettingsForm";

const NO_OVERWRITES = { roles: [], members: [] };

/**
 * Loads what the channel screen starts from (roles, the caller's permissions, the channel's
 * overwrites), then mounts the form once. Keyed by channel, the form's draft never goes stale.
 */
export function ChannelSettings(props: ChannelSettingsProps) {
  const { server, channel, members } = props;
  const me = useAuth().user!;
  const serverPermissions = useServerPermissions(server.id);
  const canManagePermissions = channel
    ? channel.permissions.includes("MANAGE_ROLES")
    : Boolean(serverPermissions.data?.includes("MANAGE_ROLES"));
  const roles = useRoles(server.id);
  const overwrites = useChannelPermissions(channel && canManagePermissions ? channel.id : null);

  const everyone = roles.data?.find((role) => role.isDefault);
  const myMember = members.find((member) => member.userId === me.id);
  const ready = everyone && myMember && serverPermissions.data && (!overwrites.isEnabled || overwrites.data);
  const title = channel ? `${channel.type === "voice" ? "🔊" : "#"} ${channel.name}` : "Criar canal";

  return (
    <Modal title={title} onClose={props.onClose}>
      {ready ? (
        <ChannelSettingsForm
          key={channel?.id ?? "new"}
          {...props}
          roles={roles.data!}
          everyoneRoleId={everyone.id}
          myMemberId={myMember.id}
          initial={overwrites.data ?? NO_OVERWRITES}
          canManageChannel={channel ? channel.permissions.includes("MANAGE_CHANNELS") : true}
          canManagePermissions={canManagePermissions}
          isAdmin={serverPermissions.data!.includes("ADMINISTRATOR")}
        />
      ) : (
        <p className="channel-settings-loading">
          {roles.error || overwrites.error || serverPermissions.error ? "Não foi possível abrir o canal." : "Carregando..."}
        </p>
      )}
    </Modal>
  );
}
