import type { ButtonHTMLAttributes, ChangeEvent, InputHTMLAttributes, ReactNode } from "react";
import type { PasswordStrength } from "./password.types";
import type { DiscoveredServer, PublicServer, ServerCategory } from "./servers.types";

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

/** A viewport point, in px. */
export type Point = { x: number; y: number };

export type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Where the opening animation starts from (the centre of the button that opened it). */
  origin?: Point | null;
};

export type ServerWheelProps = {
  servers: PublicServer[];
  activeServerId: string | null;
  onOpenServer: (serverId: string) => void;
  onAdd: () => void;
};

export type ServerAvatarProps = { server: PublicServer };

export type SearchServersDialogProps = {
  origin: Point;
  onClose: () => void;
  onPick: (serverId: string) => void;
};

export type DiscoverNavProps = {
  active: ServerCategory | null;
  onPick: (category: ServerCategory | null) => void;
  search: string;
  onSearch: (event: ChangeEvent<HTMLInputElement>) => void;
  onCreate: () => void;
  onJoin: () => void;
};

export type ServerCardProps = {
  server: DiscoveredServer;
  joining: boolean;
  onOpen: (serverId: string) => void;
};

export type JoinServerDialogProps = { onClose: () => void; onDone: (serverId: string) => void };

export type ImagePickerProps = {
  label: string;
  name: "icon" | "banner";
  previewUrl: string | null;
  /** wide = banner proportions, square = icon. */
  shape: "wide" | "square";
  error?: string;
};
