/** Mirrors the backend Zod schemas. The API is the authority; these only drive form feedback. */
export const LIMITS = {
  username: { min: 3, max: 32, pattern: /^[a-zA-Z0-9_.]+$/ },
  password: { min: 8, max: 128 },
  displayName: { min: 1, max: 64 },
  email: { max: 255 },
  serverName: { min: 2, max: 100 },
  imageMaxBytes: 5 * 1024 * 1024,
} as const;
