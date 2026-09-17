export type PasswordLevel = "weak" | "medium" | "strong";

export type PasswordStrength = {
  /** 0 to 5. Only used to fill the meter; the decision is `level`. */
  score: number;
  level: PasswordLevel;
  /** The single most useful thing to fix next, or null when there is nothing left. */
  hint: string | null;
};
