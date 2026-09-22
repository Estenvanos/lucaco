import type { z } from "zod";
import type { SERVER_CATEGORIES } from "../constants/server-categories";
import type { channelFormSchema, createServerSchema, joinServerSchema } from "../schemas/servers.schema";
import type { UserStatus } from "./users.types";

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

export type ChannelType = "text" | "voice";

export type Channel = {
  id: string;
  serverId: string;
  type: ChannelType;
  name: string;
  topic: string | null;
  position: number;
  /** Voice only: people allowed in the call at once. */
  userLimit: number;
  createdAt: string;
  /** What the current user may do here, overwrites applied. */
  permissions: PermissionName[];
};

/** Every server permission name (backend PERMISSIONS). */
export type PermissionName =
  | "VIEW_CHANNELS"
  | "SEND_MESSAGES"
  | "MANAGE_MESSAGES"
  | "CONNECT"
  | "SPEAK"
  | "STREAM"
  | "MANAGE_ROLES"
  | "MANAGE_SERVER"
  | "KICK_MEMBERS"
  | "ADMINISTRATOR"
  | "MANAGE_CHANNELS"
  | "SEND_VOICE_MESSAGES"
  | "ATTACH_FILES"
  | "BAN_MEMBERS";

/** The ones a channel overwrite may touch (backend CHANNEL_PERMISSIONS). */
export type ChannelPermission = Extract<
  PermissionName,
  "VIEW_CHANNELS" | "MANAGE_CHANNELS" | "MANAGE_ROLES" | "SEND_MESSAGES" | "SEND_VOICE_MESSAGES" | "ATTACH_FILES" | "CONNECT" | "SPEAK" | "STREAM"
>;

export type PermissionGroup = {
  title: string;
  only?: ChannelType;
  permissions: { id: ChannelPermission; label: string; description: string }[];
};

export type Role = {
  id: string;
  serverId: string;
  name: string;
  color: number | null;
  position: number;
  isDefault: boolean;
  permissions: PermissionName[];
};

/** One overwrite: allowed bits, denied bits; anything else inherits. */
export type Overwrite = { allow: ChannelPermission[]; deny: ChannelPermission[] };
/** The ✕ / / / ✓ of one permission row. */
export type OverwriteState = "deny" | "inherit" | "allow";
/** Who an overwrite targets in the editor. */
export type OverwriteTarget = { kind: "role"; id: string } | { kind: "member"; id: string };

export type ChannelOverwrites = {
  roles: (Overwrite & { roleId: string })[];
  members: (Overwrite & { memberId: string })[];
};

export type ChannelSettingsTab = "overview" | "permissions";

export type ChannelFormValues = z.infer<typeof channelFormSchema>;
export type CreateChannelInput = ChannelFormValues & { type: ChannelType; permissions: ChannelOverwrites };

export type ServerMember = {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  nickname: string | null;
  roleIds: string[];
  /** Owner or holder of an ADMINISTRATOR role. */
  isAdmin: boolean;
  joinedAt: string;
};
