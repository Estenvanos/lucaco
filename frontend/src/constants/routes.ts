/** Every app path lives here: no route string is written inline in a page or component. */
export const ROUTES = {
  home: "/",
  /** Pattern for the router; `server(id)` builds the link. */
  serverPattern: "/servers/:serverId",
  server: (serverId: string) => `/servers/${serverId}`,
  discover: "/descobrir",
  newServer: "/novo-servidor",
  signIn: "/sign-in",
  signUp: "/sign-up",
} as const;
