import { useNavigate } from "react-router";
import { ROUTES } from "../../constants/routes";
import { SETTINGS_SECTIONS } from "../../constants/settings";
import type { SettingsNavProps } from "../../types/ui.types";

/** Same top bar as Descobrir and Amigos: reuses their classes so the pages stay in step. */
export function SettingsNav({ active }: SettingsNavProps) {
  const navigate = useNavigate();

  return (
    <header className="discover-nav">
      <nav className="discover-tabs" aria-label="Configurações">
        {SETTINGS_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            aria-current={section.id === active}
            onClick={() => navigate(ROUTES.settings(section.id))}
          >
            {section.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
