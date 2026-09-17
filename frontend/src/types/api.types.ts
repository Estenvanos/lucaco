export type ApiErrorBody = { error: string };

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Set for endpoints that must not trigger the 401 refresh retry (the refresh call itself). */
  skipRefresh?: boolean;
};
