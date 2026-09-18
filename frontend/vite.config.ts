import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const api = process.env.API_URL ?? "http://localhost:3333";

// Same-origin proxy: refresh cookie (path=/auth, SameSite=Strict) works without CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [".ngrok-free.dev"],
    proxy: {
      // One entry per API router in backend/src/server.ts — a missing prefix silently falls
      // through to index.html and the request comes back as HTML.
      "/auth": api,
      "/users": api,
      "/servers": api,
      "/friends": api,
      "/notifications": api,
      "/messages": api,
      "/socket.io": { target: api, ws: true },
    },
  },
});
