import { SERVER_CATEGORIES } from "../../constants/server-categories";
import type { DiscoverNavProps } from "../../types/ui.types";

export function DiscoverNav({ active, onPick, search, onSearch, onCreate, onJoin }: DiscoverNavProps) {
  return (
    <header className="discover-nav">
      <nav className="discover-tabs" aria-label="Categorias">
        <button type="button" aria-current={active === null} onClick={() => onPick(null)}>
          Início
        </button>
        {SERVER_CATEGORIES.map((category) => (
          <button
            key={category.value}
            type="button"
            aria-current={active === category.value}
            onClick={() => onPick(category.value)}
          >
            {category.label}
          </button>
        ))}
      </nav>

      <div className="discover-actions">
        <label className="discover-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input type="search" value={search} onChange={onSearch} placeholder="Buscar" aria-label="Buscar servers" />
        </label>
        <button type="button" className="discover-join" onClick={onJoin}>
          Tenho um convite
        </button>
        <button type="button" className="discover-add" onClick={onCreate}>
          Criar server
        </button>
      </div>
    </header>
  );
}
