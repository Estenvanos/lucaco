/** Mirrors the backend Zod schemas. The API is the authority; these only drive form feedback. */
export const LIMITS = {
  username: { min: 3, max: 32, pattern: /^[a-zA-Z0-9_.]+$/ },
  password: { min: 8, max: 128 },
  /** Guards the E2E key backup, which the API holds: it must survive offline guessing. */
  recoveryPassword: { min: 12, max: 128 },
  displayName: { min: 1, max: 64 },
  email: { max: 255 },
  serverName: { min: 2, max: 100 },
  serverDescription: { max: 300 },
  channelName: { max: 100 },
  channelTopic: { max: 1024 },
  /** People allowed in a voice call at once. */
  voiceUsers: { min: 1, max: 12 },
  /** Voice messages: the recorder stops by itself at this length. The API caps files at 5 MB. */
  voiceMessageMs: 2 * 60 * 1000,
  friendRequestMessage: { max: 120 },
  /** Plaintext cap: the ciphertext (base64 + GCM tag) must fit the API's 8 KiB limit. */
  messageText: { max: 2000 },
  imageMaxBytes: 5 * 1024 * 1024,
  /** Chat attachments by kind (mirrors MEDIA_MAX_BYTES in the API). */
  attachmentBytes: { image: 15 * 1024 * 1024, file: 30 * 1024 * 1024, video: 100 * 1024 * 1024 },
  /** Extensions the API takes per kind (mirrors MEDIA_FORMATS and imageMimeSchema). */
  attachmentFormats: {
    image: ["png", "jpg", "jpeg", "webp", "gif", "avif"],
    file: ["pdf", "txt", "csv", "md", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "zip", "7z", "rar"],
    video: ["mp4", "webm", "mov", "ogv"],
  },
} as const;

/** What the attachment file input offers: every allowed extension. */
export const ATTACHMENT_ACCEPT = Object.values(LIMITS.attachmentFormats)
  .flat()
  .map((ext) => `.${ext}`)
  .join(",");
