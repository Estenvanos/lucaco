import { useParams } from "react-router";
import { SETTINGS_SECTIONS } from "../constants/settings";
import type { SettingsSection } from "../types/users.types";

/** The tab comes from the URL, so it survives a reload and the back button. Unknown = the first. */
export function useSettingsSection(): SettingsSection {
  const { section } = useParams();
  return SETTINGS_SECTIONS.find((s) => s.id === section)?.id ?? SETTINGS_SECTIONS[0]!.id;
}
