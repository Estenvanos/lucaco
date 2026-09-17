import { useMutation } from "@tanstack/react-query";
import { ENDPOINTS } from "../../constants/endpoints";
import { request, setAccessToken } from "../../lib/api";
import { queryClient } from "../../lib/query-client";
import type { AuthSession, SignInInput, SignUpInput } from "../../types/auth.types";
import { usersKeys } from "../users/users.keys";

const start = ({ accessToken, user }: AuthSession) => {
  setAccessToken(accessToken);
  queryClient.setQueryData(usersKeys.me(), user);
  return user;
};

export const useSignIn = () =>
  useMutation({
    mutationFn: (input: SignInInput) =>
      request<AuthSession>(ENDPOINTS.auth.signIn, { method: "POST", body: input }),
    onSuccess: start,
  });

export const useSignUp = () =>
  useMutation({
    mutationFn: (input: SignUpInput) =>
      request<AuthSession>(ENDPOINTS.auth.signUp, { method: "POST", body: input }),
    onSuccess: start,
  });

export const useLogout = () =>
  useMutation({
    mutationFn: () => request<void>(ENDPOINTS.auth.logout, { method: "POST", skipRefresh: true }),
    // Runs on failure too: a logout that did not reach the API still has to clear the client.
    onSettled: () => {
      setAccessToken(null);
      queryClient.clear();
    },
  });
