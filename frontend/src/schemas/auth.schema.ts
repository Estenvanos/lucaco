import { z } from "zod";
import { LIMITS } from "../constants/limits";
import { listRules, missingPasswordRules, scorePassword } from "../lib/utils";

export const signInSchema = z.object({
  login: z.string().trim().min(1, "Informe email ou username"),
  password: z.string().min(1, "Informe a senha"),
});

export const signUpSchema = z.object({
  username: z
    .string()
    .trim()
    .min(LIMITS.username.min, `Mínimo ${LIMITS.username.min} caracteres`)
    .max(LIMITS.username.max)
    .regex(LIMITS.username.pattern, "Use apenas letras, números, _ e ."),
  email: z.email("Email inválido").max(LIMITS.email.max),
  // Client-side gate only: the API accepts any password with 8+ characters. ponytail: move the
  // same check into auth.schema.ts on the backend before opening sign-up to the public.
  password: z
    .string()
    .min(LIMITS.password.min, `Mínimo ${LIMITS.password.min} caracteres`)
    .max(LIMITS.password.max)
    .superRefine((value, ctx) => {
      const missing = missingPasswordRules(value);
      if (missing.length > 0) {
        ctx.addIssue({ code: "custom", message: `A senha precisa de ${listRules(missing)}` });
        return;
      }
      if (scorePassword(value).level === "weak") {
        ctx.addIssue({ code: "custom", message: "Senha fraca demais: siga a dica abaixo" });
      }
    }),
  // An empty input arrives as "", which the API rejects: send nothing instead.
  displayName: z
    .string()
    .trim()
    .max(LIMITS.displayName.max)
    .optional()
    .transform((value) => value || undefined),
});
