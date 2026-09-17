import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { JSON_BODY_LIMIT } from "./lib/constants.js";
import { env } from "./env.js";
import { errorHandler, notFoundHandler } from "./lib/error-handler.js";
import { logger, requestLogger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { ensureBucket } from "./lib/storage.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { friendsRouter } from "./modules/friends/friends.routes.js";
import { serversRouter } from "./modules/servers/servers.routes.js";
import { registerVoiceSocket } from "./modules/voice/voice.routes.js";

process.on("unhandledRejection", (err) => logger.error("Unhandled rejection:", err));
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception:", err);
  process.exit(1);
});

const app = express();

app.set("trust proxy", 1);
app.use(requestLogger);
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/servers", serversRouter);
app.use("/friends", friendsRouter);
app.use(notFoundHandler);
app.use(errorHandler);

/** Fails fast with a readable hint instead of a raw ECONNREFUSED stack. */
async function checkDependency(name: string, target: string, check: () => Promise<unknown>) {
  try {
    await check();
  } catch {
    logger.error(`${name} unreachable at ${target}`);
    logger.error("Start the services with `npm run services` in the project root (Docker must be running).");
    process.exit(1);
  }
}

await checkDependency("Postgres", new URL(env.DATABASE_URL).host, () => prisma.$queryRaw`SELECT 1`);
await checkDependency("MinIO", env.S3_ENDPOINT, ensureBucket);

const server = createServer(app);
registerVoiceSocket(new Server(server, { cors: { origin: env.CORS_ORIGIN, credentials: true } }));
server.listen(env.PORT, () => logger.info(`API listening on :${env.PORT}`));
