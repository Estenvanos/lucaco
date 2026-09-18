import type { ButtonHTMLAttributes, ChangeEvent, FormEvent, InputHTMLAttributes, KeyboardEvent, ReactNode } from "react";
import type { ZodForm } from "./form.types";
import type { AddFriendInput, FriendsTab, PublicFriendship } from "./friends.types";
import type { AudioRef, ChatRow, Conversation, VoiceRecorder } from "./messages.types";
import type { SettingsSection, UserProfile } from "./users.types";
import type { AppNotification } from "./notifications.types";
import type { PasswordStrength } from "./password.types";
import type { UserAudio, VoiceSnapshot, VoiceStream, VoiceTile } from "./voice.types";
import type {
  Channel,
  ChannelOverwrites,
  ChannelPermission,
  ChannelType,
  DiscoveredServer,
  OverwriteState,
  OverwriteTarget,
  Role,
  PublicServer,
  ServerCategory,
  ServerMember,
} from "./servers.types";

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
  /** Entries are friends: right-click opens the user menu. */
  userMenus?: boolean;
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
  name: "icon" | "banner" | "avatar";
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
  /** Who wrote a message; unknown senders (left the server) get a placeholder. */
  authorOf: (senderId: string) => ChatPerson;
  /** Shown above the first message once the whole history is loaded. */
  intro: { title: string; text: string };
  /** Name of who is typing right now, if anyone. */
  typingName: string | null;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
};

export type ComposerProps = {
  placeholder: string;
  label: string;
  /** Why the user cannot write here; the composer is shown disabled with it. */
  blocked?: string | null;
  sending: boolean;
  error: string | null;
  /** The microphone button; null when voice messages are not allowed. */
  voice: VoiceRecorder | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onInput?: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
};

export type AudioMessageProps = { audio: AudioRef };

export type ProfileCardProps = { user: UserProfile };

export type ChatViewProps = { peerId: string };

export type ServerChannelsProps = {
  server: PublicServer;
  currentUserId: string;
  voiceChannel: Channel | null;
  members: ServerMember[];
  textChannels: Channel[];
  activeChannelId: string | null;
  /** Shows the "+" that opens the new channel screen. */
  canManage: boolean;
  onCreateChannel: () => void;
  /** Opens a channel's settings; only offered where the user may change something. */
  onEditChannel: (channel: Channel) => void;
  voice: VoiceSnapshot;
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  onMuteVoice: () => void;
  onDeafenVoice: () => void;
  onShareVoice: () => void;
  onUserVolume: (userId: string, volume: number) => void;
  onUserMute: (userId: string) => void;
};

/** `onClose` shows the close button: the channel is a side panel of the voice call. */
export type ChannelViewProps = { channel: Channel; onClose?: () => void };

export type VoiceStageProps = {
  voice: VoiceSnapshot;
  outputId: string | null;
  channelName: string;
  tiles: VoiceTile[];
  /** Text channel the chat button opens beside the call ("geral"). */
  chatChannel: Channel | null;
  chatOpen: boolean;
  onToggleChat: () => void;
  onMute: () => void;
  onDeafen: () => void;
  onShare: () => void;
  onLeave: () => void;
  onUserVolume: (userId: string, volume: number) => void;
  onUserMute: (userId: string) => void;
  onWatch: (socketId: string) => void;
  onUnwatch: () => void;
};

/** `local` = this tab's own tile: no per-user audio menu. */
export type VoiceTileProps = {
  tile: VoiceTile;
  local: boolean;
  /** Still of this tab's own share, shown on the local tile while sharing. */
  preview: string | null;
  onWatch: () => void;
  onVolume: (volume: number) => void;
  onMute: () => void;
};

export type VoiceUserMenuProps = { name: string; audio: UserAudio; onVolume: (volume: number) => void; onMute: () => void };

export type StreamViewersProps = { viewers: ChatPerson[] };

export type VoiceMediaProps = { item: VoiceStream; outputId: string | null; deafened: boolean; audio: UserAudio | undefined };

export type MemberListProps = { server: PublicServer; members: ServerMember[] };

/** Who a right-click menu is about. `member` (in a server) adds the moderation items. */
export type UserActionsMenuProps = {
  user: { id: string; username: string; name: string };
  member?: { serverId: string; ownerId: string; memberId: string; isAdmin: boolean };
};

export type SettingsNavProps = { active: SettingsSection };

export type ChannelSettingsProps = {
  server: PublicServer;
  /** null: the screen creates a new channel of `type`. */
  channel: Channel | null;
  type: ChannelType;
  members: ServerMember[];
  onClose: () => void;
  onCreated: (channel: Channel) => void;
};

export type ChannelSettingsFormProps = Omit<ChannelSettingsProps, "members"> & {
  everyoneRoleId: string;
  myMemberId: string;
  initial: ChannelOverwrites;
  canManageChannel: boolean;
  canManagePermissions: boolean;
  isAdmin: boolean;
  roles: Role[];
  members: ServerMember[];
};

export type ChannelPermissionsProps = {
  type: ChannelType;
  roles: Role[];
  members: ServerMember[];
  isPrivate: boolean;
  onTogglePrivate: (on: boolean) => void;
  targets: OverwriteTarget[];
  selected: OverwriteTarget;
  onSelect: (target: OverwriteTarget) => void;
  onAdd: (target: OverwriteTarget) => void;
  onRemove: (target: OverwriteTarget) => void;
  stateOf: (target: OverwriteTarget, permission: ChannelPermission) => OverwriteState;
  onChange: (target: OverwriteTarget, permission: ChannelPermission, state: OverwriteState) => void;
};

export type PermissionSwitchProps = {
  label: string;
  value: OverwriteState;
  onChange: (state: OverwriteState) => void;
};
