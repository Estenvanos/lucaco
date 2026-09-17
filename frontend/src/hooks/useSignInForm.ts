import { useNavigate } from "react-router";
import { ROUTES } from "../constants/routes";
import { signInSchema } from "../schemas/auth.schema";
import { useSignIn } from "../services/auth/auth.api";
import { useZodForm } from "./useZodForm";

export function useSignInForm() {
  const signIn = useSignIn();
  const navigate = useNavigate();
  const form = useZodForm(signInSchema, async (values) => {
    await signIn.mutateAsync(values);
    navigate(ROUTES.home);
  });

  return { ...form, loading: signIn.isPending };
}
