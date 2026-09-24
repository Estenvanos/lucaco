import { useNavigate } from "react-router";
import type { SettingsNavProps } from "../../types/ui.types";

/** Same top bar as Descobrir and Amigos: reuses their classes so the pages stay in step. */
export function SettingsNav<T extends string>({ label, sections, active, hrefFor }: SettingsNavProps<T>) {
  const navigate = useNavigate();

  return (
    <header className="discover-nav">
      <nav className="discover-tabs" aria-label={label}>
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            aria-current={section.id === active}
            onClick={() => navigate(hrefFor(section.id))}
          >
            {section.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
