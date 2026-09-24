import { z } from "zod";

export const RULES_MAX = 20;

export const rulesParamsSchema = z.object({
  serverId: z.string().uuid(),
});

/** The whole ordered list is saved at once; the array index is the position. */
export const replaceRulesSchema = z.object({
  rules: z.array(z.string().trim().min(1).max(300)).max(RULES_MAX),
});

export type ReplaceRulesInput = z.infer<typeof replaceRulesSchema>;
