import type { z } from "zod";
import type { SERVER_CATEGORIES } from "../constants/server-categories";
import type { createServerSchema, joinServerSchema } from "../schemas/servers.schema";

export type ServerCategory = (typeof SERVER_CATEGORIES)[number]["value"];

export type PublicServer = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  category: ServerCategory;
  iconUrl: string | null;
  bannerUrl: string | null;
  visibility: "public" | "private";
  createdAt: string;
};

/** A public server as the discovery page lists it. */
export type DiscoveredServer = PublicServer & { memberCount: number };

/** The form values: icon and banner travel separately, as multipart, after the server exists. */
export type CreateServerValues = z.infer<typeof createServerSchema>;
export type CreateServerInput = Omit<CreateServerValues, "icon" | "banner">;
/** What the create page's live preview mirrors from the form. */
export type ServerDraft = { name: string; description: string; iconUrl: string | null; bannerUrl: string | null };

export type ServerImageKind = "icon" | "banner";
export type JoinServerInput = z.infer<typeof joinServerSchema>;
