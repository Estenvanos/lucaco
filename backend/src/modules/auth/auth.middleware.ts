import type { NextFunction, Request, Response } from "express";
import type { Socket } from "socket.io";
import { HttpError } from "../../lib/http-error.js";
import { getById } from "../users/users.services.js";
import { verifyAccessToken, type AccessPayload } from "./auth.services.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AccessPayload;
    }
  }
}

// ponytail: stateless check, a revoked session's access token lives until it expires (<= JWT_ACCESS_TTL).
// Add the Redis blocklist from the architecture doc when that window matters.
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) throw new HttpError(401, "Missing access token");
  req.auth = verifyAccessToken(token);
  next();
}

/** Socket.IO handshake auth: client connects with `auth: { token }`. */
export async function requireSocketAuth(socket: Socket, next: (err?: Error) => void) {
  try {
    const { sub } = verifyAccessToken(String(socket.handshake.auth.token ?? ""));
    const user = await getById(sub);
    socket.data.userId = user.id;
    socket.data.username = user.displayName ?? user.username;
    next();
  } catch {
    next(new Error("unauthorized"));
  }
}
