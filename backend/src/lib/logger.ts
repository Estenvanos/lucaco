import type { NextFunction, Request, Response } from "express";
import pc from "picocolors";

const time = () => pc.dim(new Date().toLocaleTimeString("pt-BR"));

export const logger = {
  info: (...args: unknown[]) => console.log(time(), pc.cyan("info "), ...args),
  warn: (...args: unknown[]) => console.warn(time(), pc.yellow("warn "), ...args),
  error: (...args: unknown[]) => console.error(time(), pc.red("error"), ...args),
};

const METHOD_COLORS: Record<string, (text: string) => string> = {
  GET: pc.green,
  POST: pc.yellow,
  PUT: pc.blue,
  PATCH: pc.magenta,
  DELETE: pc.red,
};

function statusColor(status: number) {
  if (status >= 500) return pc.red;
  if (status >= 400) return pc.yellow;
  if (status >= 300) return pc.cyan;
  return pc.green;
}

/** One colored line per finished request: time, method, status, url, duration. */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = performance.now();
  res.on("finish", () => {
    const method = (METHOD_COLORS[req.method] ?? pc.white)(req.method.padEnd(6));
    const status = pc.bold(statusColor(res.statusCode)(String(res.statusCode)));
    const ms = pc.dim(`${(performance.now() - start).toFixed(1)}ms`);
    console.log(time(), method, status, req.originalUrl, ms);
  });
  next();
}
