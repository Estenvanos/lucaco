import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../generated/prisma/client.js";
import { env } from "../env.js";

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

/**
 * Runs fn as the restricted role `lucaco_app` with app.user_id = userId, so Row Level Security
 * applies (the default connection owns the tables and bypasses it). Tables with enforced RLS are
 * listed in the server_settings migration; lucaco_app has no grant on any other table.
 * ponytail: only the server-settings tables go through here — moving servers/roles/members too
 * needs write policies for join, discover and invites first.
 */
export function withUser<T>(userId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    await tx.$executeRaw`SET LOCAL ROLE lucaco_app`;
    return fn(tx);
  });
}
