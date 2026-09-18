import type { ReactNode } from "react";
import type { z } from "zod";
import type { signInSchema, signUpSchema } from "../schemas/auth.schema";
import type { changeEmailSchema, changePasswordSchema } from "../schemas/users.schema";
import type { PublicUser } from "./users.types";

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ChangePasswordInput = Omit<z.infer<typeof changePasswordSchema>, "confirmPassword">;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

export type AuthSession = { accessToken: string; user: PublicUser };
export type RefreshResponse = { accessToken: string };

export type AuthContextValue = {
  user: PublicUser | null;
  isAuthenticated: boolean;
  /** True only until the first answer about the session (user or no session). */
  isLoading: boolean;
};

export type AuthProviderProps = { children: ReactNode };
