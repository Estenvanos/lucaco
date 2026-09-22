import type { ChannelPermission, PermissionGroup } from "../types/servers.types";

/**
 * Mirrors CHANNEL_PERMISSIONS in backend/src/lib/constants.ts: the only bits a channel overwrite
 * may touch. Grouped like the permissions screen shows them; `only` hides a group on the other
 * kind of channel.
 */
export const CHANNEL_PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: "Permissões gerais do canal",
    permissions: [
      {
        id: "VIEW_CHANNELS",
        label: "Ver canal",
        description:
          "Permite que os membros vejam este canal. Desabilitar para @everyone torna o canal privado.",
      },
      {
        id: "MANAGE_CHANNELS",
        label: "Gerenciar canal",
        description: "Permite mudar o nome e o tópico deste canal. Também permite excluí-lo.",
      },
      {
        id: "MANAGE_ROLES",
        label: "Gerenciar permissões",
        description: "Permite mudar as permissões deste canal.",
      },
    ],
  },
  {
    title: "Permissões de canal de texto",
    only: "text",
    permissions: [
      { id: "SEND_MESSAGES", label: "Enviar mensagens", description: "Permite mandar mensagens neste canal." },
      {
        id: "SEND_VOICE_MESSAGES",
        label: "Enviar mensagens de voz",
        description: 'Permite mandar áudios gravados neste canal. Também requer "Enviar mensagens".',
      },
      {
        id: "ATTACH_FILES",
        label: "Anexar arquivos",
        description: 'Permite mandar imagens, documentos e vídeos neste canal. Também requer "Enviar mensagens".',
      },
    ],
  },
  {
    title: "Permissões de canal de voz",
    only: "voice",
    permissions: [
      { id: "CONNECT", label: "Conectar", description: "Permite entrar no canal de voz." },
      { id: "SPEAK", label: "Falar", description: "Permite falar no canal. Sem ela, o membro entra mutado." },
      { id: "STREAM", label: "Transmitir", description: "Permite compartilhar uma aba do navegador na chamada." },
    ],
  },
];

export const CHANNEL_PERMISSION_IDS: ChannelPermission[] = CHANNEL_PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.id),
);
