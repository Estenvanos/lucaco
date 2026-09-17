import { useState, type ChangeEvent } from "react";
import type { PasswordStrength } from "../types/password.types";
import { useNavigate } from "react-router";
import { ROUTES } from "../constants/routes";
import { scorePassword } from "../lib/utils";
import { signUpSchema } from "../schemas/auth.schema";
import { useSignUp } from "../services/auth/auth.api";
import { useZodForm } from "./useZodForm";

export function useSignUpForm() {
  const signUp = useSignUp();
  const navigate = useNavigate();
  // Only the score is state: the input stays uncontrolled, so typing does not re-render the form.
  // null until the field has something in it — no point calling an empty password weak.
  const [strength, setStrength] = useState<PasswordStrength | null>(null);

  const form = useZodForm(signUpSchema, async (values) => {
    await signUp.mutateAsync(values);
    navigate(ROUTES.home);
  });

  const onPasswordChange = (event: ChangeEvent<HTMLInputElement>) =>
    setStrength(event.target.value ? scorePassword(event.target.value) : null);

  return { ...form, loading: signUp.isPending, strength, onPasswordChange };
}
