import "dotenv/config";
import { z } from "zod";

export const env = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3333),
    CORS_ORIGIN: z.string().transform((s) => s.split(",").map((o) => o.trim())),
    DATABASE_URL: z.string().url(),
    MONGO_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: z.string().default("15m"),
    REFRESH_TTL_DAYS: z.coerce.number().default(30),
    S3_ENDPOINT: z.string().url(),
    S3_PUBLIC_ENDPOINT: z.string().url(),
    S3_REGION: z.string().default("us-east-1"),
    S3_ACCESS_KEY: z.string(),
    S3_SECRET_KEY: z.string(),
    S3_BUCKET: z.string(),
  })
  .parse(process.env);
