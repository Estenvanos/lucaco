import { z } from "zod";
import { LIMITS } from "../constants/limits";

export const createServerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(LIMITS.serverName.min, `Mínimo ${LIMITS.serverName.min} caracteres`)
    .max(LIMITS.serverName.max),
  visibility: z.enum(["public", "private"]),
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
