import { withUser } from "../../lib/prisma.js";
import * as auditService from "../audit/audit.services.js";
import * as serversService from "../servers/servers.services.js";
import type { ReplaceRulesInput } from "./rules.schema.js";

const toPublicRule = (rule: { id: string; position: number; content: string }) => ({
  id: rule.id,
  position: rule.position,
  content: rule.content,
});

export async function list(serverId: string, userId: string) {
  await serversService.getMember(serverId, userId);
  const rules = await withUser(userId, (tx) =>
    tx.serverRule.findMany({ where: { serverId }, orderBy: { position: "asc" } }),
  );
  return rules.map(toPublicRule);
}

/** Replaces the list in one transaction: readers never see half of an edit. */
export async function replace(serverId: string, userId: string, { rules }: ReplaceRulesInput) {
  await serversService.requirePermission(serverId, userId, "MANAGE_SERVER");
  const saved = await withUser(userId, async (tx) => {
    await tx.serverRule.deleteMany({ where: { serverId } });
    await tx.serverRule.createMany({
      data: rules.map((content, position) => ({ serverId, position, content })),
    });
    await auditService.record(tx, {
      serverId,
      actorId: userId,
      action: "rules_update",
      details: { count: rules.length },
    });
    return tx.serverRule.findMany({ where: { serverId }, orderBy: { position: "asc" } });
  });
  return saved.map(toPublicRule);
}
