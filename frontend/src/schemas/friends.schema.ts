import { z } from "zod";
import { LIMITS } from "../constants/limits";

export const addFriendSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Informe um nome de usuário")
    .max(LIMITS.username.max)
    .regex(LIMITS.username.pattern, "Nome de usuário inválido"),
  message: z
    .string()
    .trim()
    .max(LIMITS.friendRequestMessage.max, `Máximo ${LIMITS.friendRequestMessage.max} caracteres`),
});
