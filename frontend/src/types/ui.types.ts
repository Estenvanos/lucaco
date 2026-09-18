import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import type { PasswordStrength } from "./password.types";
import type { PublicServer } from "./servers.types";

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

export type AddServerTab = "create" | "join";

export type ModalProps = { title: string; onClose: () => void; children: ReactNode };

export type ServerWheelProps = {
  servers: PublicServer[];
  activeServerId: string | null;
  onOpenServer: (serverId: string) => void;
  onAdd: () => void;
};

export type ServerAvatarProps = { server: PublicServer };

export type AddServerDialogProps = { onClose: () => void; onDone: (serverId: string) => void };
