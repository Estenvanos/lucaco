import type { ServerSettingsSection } from "../types/servers.types";
import type { SettingsSection } from "../types/users.types";

/**
 * Every app path lives here: no route string is written inline in a page or component.
 * No path may start with an API prefix (/auth, /users, /servers, ...): the dev proxy and nginx
 * send those to the API, so a reload there would get JSON instead of the app.
 */
export const ROUTES = {
  home: "/",
  /** Pattern for the router; `server(id)` builds the link. */
  serverPattern: "/servidor/:serverId",
  server: (serverId: string) => `/servidor/${serverId}`,
  /** A text channel; the bare server path opens its first text channel ("geral"). */
  channelPattern: "/servidor/:serverId/:channelId",
  channel: (serverId: string, channelId: string) => `/servidor/${serverId}/${channelId}`,
  /** Conversation with a friend; the page itself comes with the messages module. */
  conversationPattern: "/conversa/:userId",
  conversation: (userId: string) => `/conversa/${userId}`,
  discover: "/descobrir",
  friends: "/amigos",
  newServer: "/novo-servidor",
  /** `:section` picks the settings tab; the bare path opens the profile. */
  settingsPattern: "/configuracoes/:section?",
  settings: (section: SettingsSection = "perfil") => `/configuracoes/${section}`,
  /** A server's settings; its own prefix so it never competes with channelPattern. */
  serverSettingsPattern: "/config-servidor/:serverId/:section?",
  serverSettings: (serverId: string, section: ServerSettingsSection = "perfil") =>
    `/config-servidor/${serverId}/${section}`,
  signIn: "/sign-in",
  signUp: "/sign-up",
} as const;
