import { z } from "zod";

export const signUpSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_.]+$/),
  email: z.email().max(255).toLowerCase(),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(64).optional(),
});

export const signInSchema = z.object({
  login: z.string().trim().min(1), // email or username
  password: z.string().min(1).max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export const changeEmailSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  email: z.email().max(255).toLowerCase(),
});

export const refreshTokenSchema = z.string().min(1);

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
