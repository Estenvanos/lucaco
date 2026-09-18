import { hashKey, useMutation } from "@tanstack/react-query";
import { ENDPOINTS } from "../../constants/endpoints";
import { request, setAccessToken } from "../../lib/api";
import { queryClient } from "../../lib/query-client";
import type {
  AuthSession,
  ChangeEmailInput,
  ChangePasswordInput,
  SignInInput,
  SignUpInput,
} from "../../types/auth.types";
import type { PublicUser } from "../../types/users.types";
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
      // Not clear(): AuthProvider observes `me` and would keep the removed user. Empty it, drop the rest.
      queryClient.setQueryData(usersKeys.me(), null);
      const me = hashKey(usersKeys.me());
      queryClient.removeQueries({ predicate: (query) => query.queryHash !== me });
    },
  });

/** Other devices are signed out by the API; this one keeps its session. */
export const useChangePassword = () =>
  useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      request<void>(ENDPOINTS.auth.password, { method: "PATCH", body: input }),
  });

export const useChangeEmail = () =>
  useMutation({
    mutationFn: (input: ChangeEmailInput) =>
      request<PublicUser>(ENDPOINTS.auth.email, { method: "PATCH", body: input }),
    onSuccess: (me) => queryClient.setQueryData(usersKeys.me(), me),
  });
