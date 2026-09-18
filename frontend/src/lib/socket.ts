import { io } from "socket.io-client";
import { API_URL, getAccessToken, refreshAccessToken } from "./api";

/**
 * The user's one socket, shared by every module (notifications now, voice and messages later).
 * The token is read on every (re)connect, so an access token refreshed by `request` is picked
 * up without rebuilding the socket.
 */
export const socket = io(API_URL, {
  autoConnect: false,
  auth: (cb) => cb({ token: getAccessToken() }),
});

// The handshake failed on an expired token: refresh once, then try again. No session left means
// the next HTTP call sends the user to sign-in, so the socket just stays down.
socket.on("connect_error", (err) => {
  if (err.message !== "unauthorized") return;
  refreshAccessToken()
    .then(() => socket.connect())
    .catch(() => {});
});

let users = 0;

/** Ref-counted connect: the socket stays open while anything is subscribed. */
export function holdSocket() {
  if (users++ === 0) socket.connect();
  return () => {
    if (--users === 0) socket.disconnect();
  };
}
