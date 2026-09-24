import { z } from "zod";
import { LIMITS } from "../constants/limits";

/** Blank rows are dropped before saving; what is left must fit the API's limits. */
export const rulesSchema = z
  .array(z.string().trim().max(LIMITS.rule.max, `Cada regra tem até ${LIMITS.rule.max} caracteres`))
  .transform((rules) => rules.filter(Boolean))
  .refine((rules) => rules.length <= LIMITS.rulesMax, `No máximo ${LIMITS.rulesMax} regras`);
