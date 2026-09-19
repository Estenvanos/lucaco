import { jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./http-error.js";
import { allOf, limits, socketLimiter } from "./rate-limit.js";

type Middleware = (req: Request, res: Response, next: NextFunction) => unknown;

function fakeRes() {
  const res = { headersSent: false, setHeader: jest.fn(), append: jest.fn(), set: jest.fn(), status: jest.fn(), send: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

/** Runs the middleware once and returns what it passed to next (undefined = allowed). */
async function call(mw: Middleware, req: Partial<Request>) {
  const next = jest.fn();
  await mw({ ip: "10.0.0.1", headers: {}, method: "POST", ...req } as Request, fakeRes(), next as NextFunction);
  return next.mock.calls[0]?.[0];
}

describe("rate limits", () => {
  it("blocks the 6th sign-in for the same IP and login with a 429", async () => {
    const req = { ip: "10.0.0.2", body: { login: "Victim@x.com" } };
    for (let i = 0; i < 5; i++) expect(await call(limits.signIn, req)).toBeUndefined();

    const err = await call(limits.signIn, { ...req, body: { login: " victim@x.com" } });
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(429);
  });

  it("keeps counting sign-in per login, so another account from the same IP still gets in", async () => {
    const ip = "10.0.0.3";
    for (let i = 0; i < 5; i++) await call(limits.signIn, { ip, body: { login: "a@x.com" } });

    expect(await call(limits.signIn, { ip, body: { login: "b@x.com" } })).toBeUndefined();
  });

  it("caps one IP across many sign-in logins", async () => {
    const ip = "10.0.0.4";
    for (let i = 0; i < 20; i++) expect(await call(limits.signInIp, { ip })).toBeUndefined();

    expect((await call(limits.signInIp, { ip }) as HttpError).status).toBe(429);
  });

  it("counts config writes per user, not per IP", async () => {
    const ip = "10.0.0.5";
    const alice = { ip, auth: { sub: "alice" } } as Partial<Request>;
    for (let i = 0; i < 30; i++) await call(limits.config, alice);

    expect((await call(limits.config, alice) as HttpError).status).toBe(429);
    expect(await call(limits.config, { ip, auth: { sub: "bob" } } as Partial<Request>)).toBeUndefined();
  });
});

describe("socket limiter", () => {
  afterEach(() => jest.useRealTimers());

  it("blocks over the limit and lets the user through after the window", async () => {
    jest.useFakeTimers();
    const limiter = socketLimiter(5000, 2);

    expect(await limiter.hit("u1")).toBeNull();
    expect(await limiter.hit("u1")).toBeNull();
    expect(await limiter.hit("u1")).toBeGreaterThan(0);
    expect(await limiter.hit("u2")).toBeNull();

    jest.advanceTimersByTime(5001);
    expect(await limiter.hit("u1")).toBeNull();
  });

  it("blocks when any of the combined limits is hit", async () => {
    const limiter = allOf(socketLimiter(60_000, 10), socketLimiter(60_000, 1));

    expect(await limiter.hit("u1")).toBeNull();
    expect(await limiter.hit("u1")).toBeGreaterThan(0);
  });
});
