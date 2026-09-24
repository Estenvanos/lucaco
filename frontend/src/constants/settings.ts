import type { NotificationTag } from "../types/notifications.types";
import type { EqBand, NoiseSuppression, SettingsSection, Theme } from "../types/users.types";
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

export const NOISE_SUPPRESSION_LABEL: Record<NoiseSuppression, string> = {
  off: "Desligada",
  browser: "Padrão do navegador",
  rnnoise: "RNNoise (IA, mais forte)",
};

/** Same bands as services/audio/processing.ts. */
export const EQ_BAND_LABEL: Record<EqBand, string> = {
  eqLow: "Graves (200 Hz)",
  eqMid: "Médios (1 kHz)",
  eqHigh: "Agudos (4 kHz)",
};

export const NOTIFICATION_TAG_LABEL: Record<NotificationTag, string> = {
  [NOTIFICATION_TAGS.friendRequest]: "Pedidos de amizade",
  [NOTIFICATION_TAGS.friendAccepted]: "Pedidos aceitos",
  [NOTIFICATION_TAGS.newMessage]: "Novas mensagens",
  [NOTIFICATION_TAGS.mention]: "Menções",
  [NOTIFICATION_TAGS.reply]: "Respostas às suas mensagens",
  [NOTIFICATION_TAGS.reaction]: "Reações às suas mensagens",
  [NOTIFICATION_TAGS.serverActivity]: "Atividade nos servers que você modera",
};
