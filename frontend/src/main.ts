import { io, type Socket } from "socket.io-client";
import { Call } from "./call";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id).value.trim();
const status = (msg: string) => ($("status").textContent = msg);

// Empty (dev, Docker) keeps every call same-origin through the proxy; set VITE_API_URL when the
// frontend is hosted apart from the API (Vercel + Railway), which makes the requests cross-origin.
const API_URL = import.meta.env.VITE_API_URL ?? "";

let accessToken: string | null = null;
let socket: Socket | null = null;
let call: Call | null = null;

async function api(path: string, body?: unknown) {
  const res = await fetch(API_URL + path, {
    method: "POST",
    credentials: "include", // sends/stores the refresh cookie cross-origin
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? {} : await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

async function refreshToken() {
  accessToken = (await api("/auth/refresh")).accessToken;
}

function onAuthenticated(username: string) {
  $("me").textContent = username;
  $("auth").hidden = true;
  $("call").hidden = false;

  socket = io(API_URL, { withCredentials: true, auth: (cb) => cb({ token: accessToken }) });
  socket.on("connect_error", async (err) => {
    if (err.message !== "unauthorized") return status(`Socket: ${err.message}`);
    try {
      await refreshToken(); // access token expired: refresh and let socket.io retry
      socket?.connect();
    } catch {
      status("Sessão expirada, entre novamente.");
    }
  });

  call = new Call(socket, {
    onStatus: status,
    onPeersChange: (peers) => {
      $("peers").replaceChildren(
        ...peers.map((p) =>
          Object.assign(document.createElement("li"), {
            textContent: p.sharing ? `${p.username} — 🖥️ compartilhando aba` : p.username,
          }),
        ),
      );
    },
    onStream: (key, stream, label) => {
      renderStream(key, stream, label);
      if (key === "local-screen") $("share").textContent = stream ? "Parar compartilhamento" : "Compartilhar aba";
    },
  });
}

/** One <video> per stream. Mic-only streams stay hidden but keep playing audio. */
function renderStream(key: string, stream: MediaStream | null, label: string) {
  const videos = $("videos");
  if (!stream) {
    videos.querySelectorAll<HTMLElement>("[data-key]").forEach((el) => {
      if (el.dataset.key === key || el.dataset.key!.startsWith(`${key}:`)) el.remove();
    });
    return;
  }

  let wrap = videos.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
  if (!wrap) {
    wrap = document.createElement("figure");
    wrap.dataset.key = key;
    const video = Object.assign(document.createElement("video"), { autoplay: true, playsInline: true });
    video.muted = key === "local-screen"; // never echo our own tab audio back
    wrap.append(video, document.createElement("figcaption"));
    videos.append(wrap);
  }
  const video = wrap.querySelector("video")!;
  if (video.srcObject !== stream) video.srcObject = stream;
  wrap.querySelector("figcaption")!.textContent = label; // tab audio may arrive before the video track
  wrap.hidden = stream.getVideoTracks().length === 0;
}

function setInCall(inCall: boolean) {
  $<HTMLButtonElement>("join").disabled = inCall;
  $<HTMLButtonElement>("leave").disabled = !inCall;
  $<HTMLButtonElement>("mute").disabled = !inCall;
  $<HTMLButtonElement>("share").disabled = !inCall;
  $("mute").textContent = "Mutar";
  $("share").textContent = "Compartilhar aba";
}

const handle = (fn: () => Promise<void>) => () => fn().catch((err: Error) => status(err.message));

$("sign-in").onclick = handle(async () => {
  const data = await api("/auth/sign-in", { login: input("login"), password: input("password") });
  accessToken = data.accessToken;
  onAuthenticated(data.user.displayName ?? data.user.username);
});

$("sign-up").onclick = handle(async () => {
  const data = await api("/auth/sign-up", {
    username: input("username"),
    email: input("login"),
    password: input("password"),
  });
  accessToken = data.accessToken;
  onAuthenticated(data.user.username);
});

$("logout").onclick = handle(async () => {
  await call?.leave().catch(() => {});
  socket?.disconnect();
  await api("/auth/logout");
  location.reload();
});

$("join").onclick = handle(async () => {
  await call!.join(input("room"));
  setInCall(true);
  status("");
});

$("leave").onclick = handle(async () => {
  await call!.leave();
  $("videos").replaceChildren();
  $("peers").replaceChildren();
  setInCall(false);
});

$("mute").onclick = () => {
  $("mute").textContent = call!.toggleMute() ? "Desmutar" : "Mutar";
};

$("share").onclick = handle(async () => {
  if (call!.sharing) call!.stopShare();
  else await call!.startShare();
});

// Restore session from the refresh cookie.
refreshToken()
  .then(async () => {
    const res = await fetch(`${API_URL}/users/me`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const user = await res.json();
    onAuthenticated(user.displayName ?? user.username);
  })
  .catch(() => {});
