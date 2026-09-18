import { THEME_LABEL } from "../../constants/settings";
import { useUserSettings } from "../../hooks/useUserSettings";
import type { Theme } from "../../types/users.types";

export function AppearanceSection() {
  const { settings, save } = useUserSettings();

  return (
    <div className="settings-form">
      <h2>Aparência</h2>
      <fieldset className="settings-choices">
        <legend>Tema</legend>
        {Object.entries(THEME_LABEL).map(([theme, label]) => (
          <label key={theme}>
            <input
              type="radio"
              name="theme"
              value={theme}
              checked={settings.theme === theme}
              onChange={() => save({ theme: theme as Theme })}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <p className="settings-hint">"Sistema" segue o tema claro ou escuro do seu sistema operacional.</p>
    </div>
  );
}
