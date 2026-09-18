import { useUpdateSettings } from "../services/users/users.api";
import type { UserSettings } from "../types/users.types";
import { useAuth } from "./useAuth";

/** Appearance and notifications: every control saves on change (optimistic, see useUpdateSettings). */
export function useUserSettings() {
  const settings = useAuth().user!.settings; // RootLayout only renders with a user
  const update = useUpdateSettings();
  return { settings, save: (input: Partial<UserSettings>) => update.mutate(input) };
}
