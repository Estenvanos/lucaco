/**
 * Fills a dev account with servers so the sidebar wheel has something to scroll through.
 * Usage: npm run seed  (API must be running: npm run services && npm run dev)
 */
import { encodePng } from "./lib/png.mjs";

const API = process.env.API_URL ?? "http://localhost:3333";
const USER = { username: "dev", email: "dev@lucaco.test", password: "Trilho-8-Verde" };

const NAMES = [
  "Time do sábado",
  "Lab de áudio",
  "Estúdio",
  "Coworking",
  "Pixel Club",
  "Mesa de RPG",
  "Casa do Lucaco",
  "Plantão noturno",
];

async function api(path, { token, ...init } = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      // FormData sets its own multipart boundary: only JSON bodies get a content type here.
      ...(typeof init.body === "string" ? { "Content-Type": "application/json" } : null),
      ...(token ? { Authorization: `Bearer ${token}` } : null),
    },
  });
  const data = res.status === 204 ? {} : await res.json();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${data.error ?? ""}`);
  return data;
}

// Sign-up first: it fails with 409 once the dev user exists, and then sign-in takes over.
const session = await api("/auth/sign-up", { method: "POST", body: JSON.stringify(USER) }).catch(() =>
  api("/auth/sign-in", {
    method: "POST",
    body: JSON.stringify({ login: USER.username, password: USER.password }),
  }),
);

const hsl = (h, s, l) => {
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
};

/** Flat two-tone disc, one hue per server, so the wheel items are told apart at a glance. */
function icon(index) {
  const hue = (index * 47) % 360;
  const back = hsl(hue, 0.5, 0.18);
  const disc = hsl(hue, 0.75, 0.62);
  const size = 160;
  const r = size * 0.33;

  return encodePng(size, (x, y) => {
    const dx = x - size / 2;
    const dy = y - size / 2;
    if (dx * dx + dy * dy < r * r) return disc;
    // Diagonal band: keeps the icon from reading as a plain dot once it is 48px wide.
    return (x + y) % 40 < 6 ? hsl(hue, 0.4, 0.26) : back;
  });
}

async function uploadIcon(serverId, index) {
  const body = new FormData();
  body.append("icon", new Blob([icon(index)], { type: "image/png" }), "icon.png");
  await api(`/servers/${serverId}/icon`, { method: "PUT", token: session.accessToken, body });
}

const servers = await api("/servers", { token: session.accessToken });
const byName = new Map(servers.map((s) => [s.name, s]));

for (const [index, name] of NAMES.entries()) {
  const server =
    byName.get(name) ??
    (await api("/servers", {
      method: "POST",
      token: session.accessToken,
      body: JSON.stringify({ name }),
    }));

  if (!byName.has(name)) console.log("criado:", name);
  if (server.iconUrl) continue;

  await uploadIcon(server.id, index);
  console.log("ícone enviado:", name);
}

console.log(`\npronto — entre com ${USER.username} / ${USER.password}`);
