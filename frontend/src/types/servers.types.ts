import type { z } from "zod";
import type { createServerSchema, joinServerSchema } from "../schemas/servers.schema";

export type PublicServer = {
  id: string;
  ownerId: string;
  name: string;
  iconUrl: string | null;
  visibility: "public" | "private";
  createdAt: string;
};

export type CreateServerInput = z.infer<typeof createServerSchema>;
export type JoinServerInput = z.infer<typeof joinServerSchema>;
