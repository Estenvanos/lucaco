import { defineConfig } from "vite";

const api = process.env.API_URL ?? "http://localhost:3333";

// Same-origin proxy: refresh cookie (path=/auth, SameSite=Strict) works without CORS.
export default defineConfig({
  server: {
    allowedHosts: [".ngrok-free.dev"],
    proxy: {
      "/auth": api,
      "/users": api,
      "/socket.io": { target: api, ws: true },
    },
  },
});
