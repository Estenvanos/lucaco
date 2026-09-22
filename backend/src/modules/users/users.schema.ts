import { z } from "zod";
import { NOTIFICATION_TAGS } from "../../lib/constants.js";

export const userIdSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * The client publishes only the public half of its ECDH P-256 keypair, exported as SPKI
 * and base64 encoded (~124 chars). The private key stays in the browser, so the upper
 * bound is just a sanity limit against someone parking data in the column.
 */
export const publishKeySchema = z.object({
  publicKey: z
    .string()
    .base64()
    .min(40)
    .max(512),
  algorithm: z.literal("ECDH-P256").default("ECDH-P256"),
  /**
   * Optional backup of the private half, already encrypted in the browser with a recovery
   * password the API never receives. Opaque to the server; bounds are sanity limits
   * (P-256 PKCS8 + GCM tag is ~208 base64 chars, salt 16 bytes, IV 12 bytes).
   */
  backup: z
    .object({
      encryptedPrivateKey: z.string().base64().min(40).max(1024),
      salt: z.string().base64().min(16).max(64),
      iv: z.string().base64().min(16).max(64),
    })
    .optional(),
});

export type PublishKeyInput = z.infer<typeof publishKeySchema>;

export const updateStatusSchema = z.object({
  status: z.enum(["online", "offline", "dnd"]),
});

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

/** Same rules as sign-up. `displayName: null` clears it (the username shows instead). */
export const updateProfileSchema = z
  .object({
    username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_.]+$/).optional(),
    displayName: z.string().trim().min(1).max(64).nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, "Nothing to update");

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

const deviceIdSchema = z.string().min(1).max(256).nullable().optional();
const eqGainSchema = z.number().int().min(-12).max(12).optional();

export const updateSettingsSchema = z
  .object({
    theme: z.enum(["system", "dark", "light"]).optional(),
    notificationsMuted: z.boolean().optional(),
    hiddenNotificationTags: z
      .array(z.enum(Object.values(NOTIFICATION_TAGS)))
      .max(4)
      .transform((tags) => [...new Set(tags)])
      .optional(),
    audioInputId: deviceIdSchema,
    audioOutputId: deviceIdSchema,
    noiseSuppression: z.enum(["off", "browser", "rnnoise"]).optional(),
    eqLow: eqGainSchema,
    eqMid: eqGainSchema,
    eqHigh: eqGainSchema,
  })
  .refine((input) => Object.keys(input).length > 0, "Nothing to update");

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
