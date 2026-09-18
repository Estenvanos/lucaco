import { z } from "zod";

export const joinSchema = z.object({
  channelId: z.string().uuid(),
});

export const streamWatchSchema = z.object({
  socketId: z.string().min(1).max(64),
});

export const screenSchema = z.object({
  sharing: z.boolean(),
});

// WebRTC signaling relayed peer to peer: either an SDP description or an ICE candidate.
export const signalSchema = z
  .object({
    to: z.string().min(1).max(64),
    description: z
      .object({ type: z.enum(["offer", "answer"]), sdp: z.string().max(200_000) })
      .optional(),
    candidate: z
      .object({
        candidate: z.string().max(2_000),
        sdpMid: z.string().max(64).nullish(),
        sdpMLineIndex: z.number().int().nullish(),
        usernameFragment: z.string().max(256).nullish(),
      })
      .optional(),
  })
  .refine((s) => Boolean(s.description) !== Boolean(s.candidate), "Send description or candidate");

export type SignalInput = z.infer<typeof signalSchema>;
