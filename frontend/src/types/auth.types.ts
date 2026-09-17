import type { z } from "zod";
import type { signInSchema, signUpSchema } from "../schemas/auth.schema";
import type { PublicUser } from "./users.types";

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

export type AuthSession = { accessToken: string; user: PublicUser };
export type RefreshResponse = { accessToken: string };
