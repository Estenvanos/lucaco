import type { Request, Response } from "express";
import { env } from "../../env.js";
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from "../../lib/constants.js";
import { HttpError } from "../../lib/http-error.js";
import { toPublicUser } from "../users/users.services.js";
import {
  changeEmailSchema,
  changePasswordSchema,
  refreshTokenSchema,
  signInSchema,
  signUpSchema,
} from "./auth.schema.js";
import * as authService from "./auth.services.js";

const meta = (req: Request) => ({ userAgent: req.get("user-agent"), ip: req.ip });

// Deployed apart (frontend on Vercel, API on Railway) the cookie is cross-site: browsers only keep
// it with SameSite=None, which in turn requires Secure. Dev stays same-origin, so Strict there.
const CROSS_SITE = env.NODE_ENV === "production";

function setRefreshCookie(res: Response, token: string, expires: Date) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: CROSS_SITE,
    sameSite: CROSS_SITE ? "none" : "strict",
    path: REFRESH_COOKIE_PATH,
    expires,
  });
}

// clearCookie only matches when the attributes match the ones used to set it.
const clearRefreshCookie = (res: Response) =>
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: CROSS_SITE,
    sameSite: CROSS_SITE ? "none" : "strict",
    path: REFRESH_COOKIE_PATH,
  });

function readRefreshCookie(req: Request) {
  const parsed = refreshTokenSchema.safeParse(req.cookies[REFRESH_COOKIE]);
  return parsed.success ? parsed.data : null;
}

export async function signUp(req: Request, res: Response) {
  const { user, accessToken, refreshToken, refreshExpiresAt } = await authService.signUp(
    signUpSchema.parse(req.body),
    meta(req),
  );
  setRefreshCookie(res, refreshToken, refreshExpiresAt);
  res.status(201).json({ accessToken, user: await toPublicUser(user) });
}

export async function signIn(req: Request, res: Response) {
  const { user, accessToken, refreshToken, refreshExpiresAt } = await authService.signIn(
    signInSchema.parse(req.body),
    meta(req),
  );
  setRefreshCookie(res, refreshToken, refreshExpiresAt);
  res.json({ accessToken, user: await toPublicUser(user) });
}

export async function refresh(req: Request, res: Response) {
  const token = readRefreshCookie(req);
  if (!token) throw new HttpError(401, "Missing refresh token");
  try {
    const { accessToken, refreshToken, refreshExpiresAt } = await authService.refresh(token, meta(req));
    setRefreshCookie(res, refreshToken, refreshExpiresAt);
    res.json({ accessToken });
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  const token = readRefreshCookie(req);
  if (token) await authService.logout(token);
  clearRefreshCookie(res);
  res.status(204).end();
}

export function getToken(req: Request, res: Response) {
  const { sub, sid, iat, exp } = req.auth!;
  res.json({ userId: sub, sessionId: sid, issuedAt: new Date(iat * 1000), expiresAt: new Date(exp * 1000) });
}

export async function changePassword(req: Request, res: Response) {
  const { sub, sid } = req.auth!;
  await authService.changePassword(sub, sid, changePasswordSchema.parse(req.body));
  res.status(204).end();
}

export async function changeEmail(req: Request, res: Response) {
  const user = await authService.changeEmail(req.auth!.sub, changeEmailSchema.parse(req.body));
  res.json(await toPublicUser(user));
}
