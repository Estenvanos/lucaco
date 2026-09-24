import { useRules } from "../../services/rules/rules.api";
import type { ServerSettingsSectionProps } from "../../types/ui.types";
import { RulesEditor } from "./RulesEditor";

export function ServerRulesSection({ server }: ServerSettingsSectionProps) {
  const { data: rules, dataUpdatedAt } = useRules(server.id);
  if (!rules) return <p className="settings-hint">Carregando...</p>;
  // A new saved list remounts the editor, which starts its draft from it.
  return <RulesEditor key={dataUpdatedAt} serverId={server.id} initial={rules.map((r) => r.content)} />;
}
