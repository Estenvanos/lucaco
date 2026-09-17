import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import type { PasswordStrength } from "./password.types";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean };

export type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
  /** Rendered inside the input box, on the trailing edge (the password eye, for instance). */
  action?: ReactNode;
};

export type PasswordFieldProps = Omit<FieldProps, "type" | "action">;

export type PasswordStrengthMeterProps = { strength: PasswordStrength | null; inputId: string };

export type FormErrorProps = { message?: string | null };

export type AuthFormFooterProps = { question: string; to: string; action: string };
