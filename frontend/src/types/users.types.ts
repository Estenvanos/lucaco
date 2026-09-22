import type { NotificationTag } from "./notifications.types";

export type UserStatus = "online" | "offline" | "dnd";

export type Theme = "system" | "dark" | "light";

/** off: raw mic; browser: the browser's own filter; rnnoise: RNNoise (xiph) in an AudioWorklet. */
export type NoiseSuppression = "off" | "browser" | "rnnoise";

export type EqBand = "eqLow" | "eqMid" | "eqHigh";

export type UserSettings = {
  theme: Theme;
  /** Bell without a counter. Presentation only: notifications still arrive. */
  notificationsMuted: boolean;
  /** Tags left out of the bell. */
  hiddenNotificationTags: NotificationTag[];
  /** MediaDeviceInfo.deviceId: per browser and origin, may not exist on this machine. */
  audioInputId: string | null;
  audioOutputId: string | null;
  noiseSuppression: NoiseSuppression;
  /** Equalizer gains in dB, -12..12: low shelf 200 Hz, peak 1 kHz, high shelf 4 kHz. */
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  /** Users whose notifications never reach this one (right-click > Silenciar). */
  mutedUserIds: string[];
};

export type SettingsSection = "perfil" | "conta" | "aparencia" | "notificacoes" | "audio";

export type AudioDevices = { inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] };

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  createdAt: string;
  settings: UserSettings;
};

export type UpdateProfileInput = { username?: string; displayName?: string | null };

/** Someone else's public profile: no email. */
export type UserProfile = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
};
