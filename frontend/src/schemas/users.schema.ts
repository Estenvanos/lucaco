import { z } from "zod";
import { LIMITS } from "../constants/limits";
import { newPasswordSchema, usernameSchema } from "./auth.schema";

export const profileSchema = z.object({
  username: usernameSchema,
  // Empty clears it: the username shows instead.
  displayName: z
    .string()
    .trim()
    .max(LIMITS.displayName.max)
    .transform((value) => value || null),
});

// An empty file input still submits a 0-byte File: that means "no image".
export const avatarSchema = z
  .instanceof(File)
  .refine((file) => file.size > 0, "Escolha uma imagem")
  .refine((file) => file.size <= LIMITS.imageMaxBytes, "Imagem de até 5 MB");

export const changeEmailSchema = z.object({
  email: z.email("Email inválido").max(LIMITS.email.max),
  currentPassword: z.string().min(1, "Informe a senha atual"),
});

export const unlockKeysSchema = z.object({
  password: z.string().min(1, "Informe a senha de recuperação"),
});

export const recoveryPasswordSchema = z
  .object({
    password: z
      .string()
      .min(LIMITS.recoveryPassword.min, `Mínimo de ${LIMITS.recoveryPassword.min} caracteres`)
      .max(LIMITS.recoveryPassword.max),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual"),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });
