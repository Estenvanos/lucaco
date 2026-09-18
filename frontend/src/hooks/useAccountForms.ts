import { useState, type ChangeEvent } from "react";
import { scorePassword } from "../lib/utils";
import { changeEmailSchema, changePasswordSchema } from "../schemas/users.schema";
import { useChangeEmail, useChangePassword } from "../services/auth/auth.api";
import type { PasswordStrength } from "../types/password.types";
import { useAuth } from "./useAuth";
import { useZodForm } from "./useZodForm";

/** Email and password: both re-ask the current password. A success remounts its form (key). */
export function useAccountForms() {
  const me = useAuth().user!; // RootLayout only renders with a user
  const changeEmail = useChangeEmail();
  const changePassword = useChangePassword();
  const [done, setDone] = useState<"email" | "password" | null>(null);
  const [emailKey, setEmailKey] = useState(0);
  const [passwordKey, setPasswordKey] = useState(0);
  const [strength, setStrength] = useState<PasswordStrength | null>(null);

  const emailForm = useZodForm(changeEmailSchema, async (values) => {
    setDone(null);
    await changeEmail.mutateAsync(values);
    setEmailKey(emailKey + 1);
    setDone("email");
  });

  const passwordForm = useZodForm(changePasswordSchema, async ({ currentPassword, newPassword }) => {
    setDone(null);
    await changePassword.mutateAsync({ currentPassword, newPassword });
    setPasswordKey(passwordKey + 1);
    setStrength(null);
    setDone("password");
  });

  const onNewPasswordChange = (event: ChangeEvent<HTMLInputElement>) =>
    setStrength(event.target.value ? scorePassword(event.target.value) : null);

  return {
    email: { ...emailForm, key: emailKey, current: me.email, loading: changeEmail.isPending, done: done === "email" },
    password: {
      ...passwordForm,
      key: passwordKey,
      loading: changePassword.isPending,
      done: done === "password",
      strength,
      onNewPasswordChange,
    },
  };
}
