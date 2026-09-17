import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { HttpError } from "./http-error.js";
import { logger } from "./logger.js";

type ErrorResponse = { status: number; body: { error: string; issues?: unknown } };

/** Maps any thrown error to a safe HTTP status + body. Shared by Express and Socket.IO handlers. */
export function toErrorResponse(err: unknown): ErrorResponse {
  if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
  if (err instanceof ZodError) return { status: 400, body: { error: "Validation failed", issues: err.issues } };
  if (err instanceof multer.MulterError) return { status: 400, body: { error: err.message } };

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return { status: 409, body: { error: "Resource already exists" } };
    if (err.code === "P2025") return { status: 404, body: { error: "Resource not found" } };
  }

  // body-parser errors (malformed JSON, payload over the limit)
  const type = (err as { type?: string })?.type;
  if (type === "entity.parse.failed") return { status: 400, body: { error: "Malformed JSON body" } };
  if (type === "entity.too.large") return { status: 413, body: { error: "Payload too large" } };

  logger.error(err);
  return { status: 500, body: { error: "Internal server error" } };
}

export const notFoundHandler: RequestHandler = (req, _res) => {
  throw new HttpError(404, `Route ${req.method} ${req.path} not found`);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const { status, body } = toErrorResponse(err);
  res.status(status).json(body);
};
