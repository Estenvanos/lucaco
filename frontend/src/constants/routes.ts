import type { SettingsSection } from "../types/users.types";

/** Every app path lives here: no route string is written inline in a page or component. */
export const ROUTES = {
  home: "/",
  /** Pattern for the router; `server(id)` builds the link. */
  serverPattern: "/servers/:serverId",
  server: (serverId: string) => `/servers/${serverId}`,
  /** A text channel; the bare server path opens its first text channel ("geral"). */
  channelPattern: "/servers/:serverId/:channelId",
  channel: (serverId: string, channelId: string) => `/servers/${serverId}/${channelId}`,
  /** Conversation with a friend; the page itself comes with the messages module. */
  conversationPattern: "/conversa/:userId",
  conversation: (userId: string) => `/conversa/${userId}`,
  discover: "/descobrir",
  friends: "/amigos",
  newServer: "/novo-servidor",
  /** `:section` picks the settings tab; the bare path opens the profile. */
  settingsPattern: "/configuracoes/:section?",
  settings: (section: SettingsSection = "perfil") => `/configuracoes/${section}`,
  signIn: "/sign-in",
  signUp: "/sign-up",
} as const;
