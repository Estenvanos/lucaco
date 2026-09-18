import type { ButtonHTMLAttributes, ChangeEvent, FormEvent, InputHTMLAttributes, KeyboardEvent, ReactNode } from "react";
import type { ZodForm } from "./form.types";
import type { AddFriendInput, FriendsTab, PublicFriendship } from "./friends.types";
import type { ChatRow, Conversation } from "./messages.types";
import type { UserProfile } from "./users.types";
import type { AppNotification } from "./notifications.types";
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

export type SidebarMode = "servers" | "friends";

export type ModeSwitchProps = { mode: SidebarMode; onToggle: () => void };

/** What the wheel needs from a server or a friend to draw one item. */
export type WheelEntry = Pick<PublicServer, "id" | "name" | "iconUrl"> & {
  /** Red dot: a friend with messages not read yet. */
  unread?: boolean;
};

export type ServerWheelProps = {
  servers: WheelEntry[];
  activeServerId: string | null;
  onOpenServer: (serverId: string) => void;
  onAdd: () => void;
};

export type ServerAvatarProps = { server: WheelEntry };

export type SearchServersDialogProps = {
  origin: Point;
  onClose: () => void;
  onPick: (serverId: string) => void;
};

export type SearchFriendsDialogProps = {
  origin: Point;
  onClose: () => void;
  onPick: (userId: string) => void;
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

export type FriendsTabsProps = {
  tab: FriendsTab;
  onChange: (tab: FriendsTab) => void;
  inboxCount: number;
  unreadCount: number;
};

export type AddFriendFormProps = {
  form: ZodForm<AddFriendInput> & {
    onChange: (event: FormEvent<HTMLFormElement>) => void;
    formKey: number;
    sentTo: string | null;
    messageLength: number;
    loading: boolean;
  };
  onDiscover: () => void;
};

export type InboxListProps = {
  notifications: AppNotification[];
  /** The user or notification id being answered right now: that row's buttons wait for it. */
  busy: string | null;
  onAccept: (userId: string) => void;
  onDecline: (userId: string) => void;
};

export type ConversationsListProps = {
  conversations: Conversation[];
  unread: Set<string>;
  onOpen: (userId: string) => void;
};

export type NotificationsPanelProps = {
  notifications: AppNotification[];
  busy: string | null;
  onClose: () => void;
  onOpen: (notification: AppNotification) => void;
  onDismiss: (notificationId: string) => void;
};

export type SentRequestsListProps = {
  requests: PublicFriendship[];
  /** The user whose request is being cancelled right now. */
  busy: string | null;
  onCancel: (userId: string) => void;
};

/** Anyone drawn in the chat: the peer (UserProfile) or me (PublicUser) both fit. */
export type ChatPerson = Pick<UserProfile, "id" | "username" | "displayName" | "avatarUrl">;

export type ChatAvatarProps = { user: ChatPerson; size?: "sm" | "lg" };

export type ChatHeaderProps = { peer: UserProfile; typing: boolean };

export type MessageListProps = {
  rows: ChatRow[];
  me: ChatPerson;
  peer: UserProfile;
  typing: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
};

export type ComposerProps = {
  peerName: string;
  sending: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onInput: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
};

export type ProfileCardProps = { user: UserProfile };

export type ChatViewProps = { peerId: string };
