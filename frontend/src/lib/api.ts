import { ENDPOINTS } from "../constants/endpoints";
import type { ApiErrorBody, RequestOptions } from "../types/api.types";
import type { RefreshResponse } from "../types/auth.types";

// Empty (dev, Docker) keeps every call same-origin through the proxy; set VITE_API_URL when the
// frontend is hosted apart from the API (Vercel + Railway), which makes the requests cross-origin.
export const API_URL = import.meta.env.VITE_API_URL ?? "";

// In memory on purpose: localStorage is readable by any XSS. The refresh token is the httpOnly
// cookie scoped to /auth, which the browser sends on its own.
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => (accessToken = token);
export const getAccessToken = () => accessToken;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function send<T>(path: string, { method = "GET", body }: RequestOptions): Promise<T> {
  // FormData (file upload) goes as-is: the browser writes the multipart Content-Type and boundary.
  const isForm = body instanceof FormData;
  const res = await fetch(API_URL + path, {
    method,
    credentials: "include", // sends/stores the refresh cookie cross-origin
    headers: {
      ...(body === undefined || isForm ? null : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : null),
    },
    body: body === undefined || isForm ? body : JSON.stringify(body),
  });

  const data = res.status === 204 ? ({} as T) : await res.json();
  if (!res.ok) throw new ApiError(res.status, (data as ApiErrorBody).error ?? res.statusText);
  return data as T;
}

/** Exchanges the refresh cookie for a new access token. Throws when there is no valid session. */
export async function refreshAccessToken() {
  const { accessToken: token } = await send<RefreshResponse>(ENDPOINTS.auth.refresh, { method: "POST" });
  setAccessToken(token);
  return token;
}

let refreshing: Promise<string> | null = null;

/** One refresh at a time: concurrent 401s wait on the same call instead of rotating the token twice. */
function refreshOnce() {
  refreshing ??= refreshAccessToken().finally(() => (refreshing = null));
  return refreshing;
}

/** The only place the app talks HTTP. Retries once after refreshing an expired access token. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await send<T>(path, options);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401 || options.skipRefresh) throw err;
    await refreshOnce();
    return send<T>(path, options);
  }
}
