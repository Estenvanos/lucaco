import type { Request } from "express";
import { ipKeyGenerator, MemoryStore, rateLimit, type Options, type RateLimitInfo } from "express-rate-limit";
import { HttpError } from "./http-error.js";

// ponytail: MemoryStore counts per process. Swap in rate-limit-redis (and a Redis-backed
// socket limiter) once the API runs on more than one instance.

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** IPv6 addresses are grouped by /56 so one host cannot rotate through its own block. */
const byIp = (req: Request) => ipKeyGenerator(req.ip ?? "");
/** Logged-in routes count per user; falls back to the IP if auth has not run. */
const byUser = (req: Request) => req.auth?.sub ?? byIp(req);

const retryAfter = (resetTime: Date | undefined) =>
  Math.max(1, Math.ceil(((resetTime?.getTime() ?? Date.now()) - Date.now()) / SECOND));

function limiter(windowMs: number, limit: number, keyGenerator: (req: Request) => string = byIp) {
  return rateLimit({
    windowMs,
    limit,
    keyGenerator,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Goes through the error handler so the body keeps the usual { error } shape.
    handler: (req, _res, next) => {
      const info = (req as Request & { rateLimit?: RateLimitInfo }).rateLimit;
      next(new HttpError(429, `Too many requests, try again in ${retryAfter(info?.resetTime)}s`));
    },
  });
}

/** Sign-in counts per IP + login (email or username), so one attacker cannot lock a victim out from another IP. */
const byIpAndLogin = (req: Request) =>
  `${byIp(req)}:${String((req.body as { login?: unknown } | undefined)?.login ?? "").trim().toLowerCase()}`;

export const limits = {
  /** Every route, per IP. */
  global: limiter(MINUTE, 300),
  signIn: limiter(15 * MINUTE, 5, byIpAndLogin),
  /** Caps one IP guessing across many logins. */
  signInIp: limiter(15 * MINUTE, 20),
  signUp: limiter(60 * MINUTE, 5),
  /** The socket and every open tab refresh, so this one is looser. */
  refresh: limiter(MINUTE, 30),
  /** Password and email changes. */
  sensitive: limiter(15 * MINUTE, 5, byUser),
  /** One budget shared by every settings write: profile, servers, channels, roles, friends. */
  config: limiter(MINUTE, 30, byUser),
  upload: limiter(MINUTE, 10, byUser),
};

export type SocketLimiter = { hit: (key: string) => Promise<number | null> };

/**
 * express-rate-limit only wraps HTTP, so socket events reuse its MemoryStore directly.
 * `hit` returns null when allowed, or the seconds to wait when blocked.
 */
export function socketLimiter(windowMs: number, limit: number): SocketLimiter {
  const store = new MemoryStore();
  store.init({ windowMs } as Options);
  return {
    async hit(key) {
      const { totalHits, resetTime } = await store.increment(key);
      return totalHits > limit ? retryAfter(resetTime) : null;
    },
  };
}

/** Blocked by any of them = blocked. Every limiter still counts the hit. */
export function allOf(...limiters: SocketLimiter[]): SocketLimiter {
  return {
    async hit(key) {
      const waits = await Promise.all(limiters.map((l) => l.hit(key)));
      const blocked = waits.filter((w): w is number => w !== null);
      return blocked.length ? Math.max(...blocked) : null;
    },
  };
}

export const socketLimits = {
  /** Burst of 5 in 5 s, and 60 per minute sustained. */
  messageSend: allOf(socketLimiter(5 * SECOND, 5), socketLimiter(MINUTE, 60)),
  typing: socketLimiter(10 * SECOND, 20),
};
