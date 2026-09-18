import type { NotificationTag } from "../types/notifications.types";
import type { SettingsSection, Theme } from "../types/users.types";
import { NOTIFICATION_TAGS } from "./notifications";

/** Settings tabs, in menu order. The first one is the default. */
export const SETTINGS_SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "perfil", label: "Perfil" },
  { id: "conta", label: "Conta e senha" },
  { id: "aparencia", label: "Aparência" },
  { id: "notificacoes", label: "Notificações" },
  { id: "audio", label: "Voz e áudio" },
];

export const THEME_LABEL: Record<Theme, string> = {
  system: "Sistema",
  dark: "Escuro",
  light: "Claro",
};

export const NOTIFICATION_TAG_LABEL: Record<NotificationTag, string> = {
  [NOTIFICATION_TAGS.friendRequest]: "Pedidos de amizade",
  [NOTIFICATION_TAGS.friendAccepted]: "Pedidos aceitos",
  [NOTIFICATION_TAGS.newMessage]: "Novas mensagens",
};
