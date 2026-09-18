import { z } from "zod";
import { LIMITS } from "../constants/limits";
import { SERVER_CATEGORIES } from "../constants/server-categories";

// An empty file input still submits a 0-byte File: that means "no image".
const optionalImage = z
  .instanceof(File)
  .transform((file) => (file.size > 0 ? file : undefined))
  .refine((file) => !file || file.size <= LIMITS.imageMaxBytes, "Imagem de até 5 MB")
  .optional();

export const createServerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(LIMITS.serverName.min, `Mínimo ${LIMITS.serverName.min} caracteres`)
    .max(LIMITS.serverName.max),
  visibility: z.enum(["public", "private"]),
  category: z.enum(SERVER_CATEGORIES.map((c) => c.value)),
  description: z
    .string()
    .trim()
    .max(LIMITS.serverDescription.max, `Máximo ${LIMITS.serverDescription.max} caracteres`),
  icon: optionalImage,
  banner: optionalImage,
});

export const joinServerSchema = z.object({
  reference: z
    .string()
    .trim()
    .refine(
      (value) => z.uuid().safeParse(value).success || /^[A-Za-z0-9_-]{12}$/.test(value),
      "Informe um ID público ou código de convite válido",
    ),
});

/** Same rule as the API: trimmed, then spaces become dashes ("bate papo" -> "bate-papo"). */
export const createChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe um nome")
    .max(LIMITS.channelName.max)
    .transform((name) => name.toLowerCase().replace(/\s+/g, "-")),
});
