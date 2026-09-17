import { z } from "zod";
import { PERMISSIONS } from "../../lib/constants.js";

const permissionName = z.enum(Object.keys(PERMISSIONS) as [keyof typeof PERMISSIONS]);

export const roleParamsSchema = z.object({
  serverId: z.string().uuid(),
  roleId: z.string().uuid().optional(),
});

export const assignParamsSchema = z.object({
  serverId: z.string().uuid(),
  roleId: z.string().uuid(),
  memberId: z.string().uuid(),
});

/** Permissions travel as names, never as a raw bitfield: the client cannot invent bits. */
export const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(64),
  color: z.number().int().min(0).max(0xffffff).nullish(),
  position: z.number().int().min(0).max(1000).optional(),
  permissions: z.array(permissionName).default([]),
});

export const updateRoleSchema = createRoleSchema.partial();

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
