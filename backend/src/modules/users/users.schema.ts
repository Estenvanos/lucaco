import { z } from "zod";

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
});

export type PublishKeyInput = z.infer<typeof publishKeySchema>;
