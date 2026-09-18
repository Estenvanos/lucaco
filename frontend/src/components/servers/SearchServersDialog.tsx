import { useServerSearch } from "../../hooks/useServerSearch";
import type { SearchServersDialogProps } from "../../types/ui.types";
import { Modal } from "../shared/Modal";
import { ServerAvatar } from "./ServerAvatar";

export function SearchServersDialog({ origin, onClose, onPick }: SearchServersDialogProps) {
  const { value, results, isFetching, onChange } = useServerSearch();

  return (
    <Modal title="Buscar servers" onClose={onClose} origin={origin}>
      {/* Enter opens the best match. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (results[0]) onPick(results[0].id);
        }}
      >
        <input
          className="search-input"
          type="search"
          value={value}
          onChange={onChange}
          placeholder="Nome do server"
          aria-label="Nome do server"
          autoFocus
        />
      </form>

      <ul className="search-results" aria-busy={isFetching}>
        {results.map((server) => (
          <li key={server.id}>
            <button type="button" className="search-result" onClick={() => onPick(server.id)}>
              <span className="search-result-icon">
                <ServerAvatar server={server} />
              </span>
              {server.name}
            </button>
          </li>
        ))}
      </ul>

      {!isFetching && results.length === 0 && (
        <p className="modal-note">
          {value.trim() ? "Nenhum server parecido com isso." : "Você ainda não está em nenhum server."}
        </p>
      )}
    </Modal>
  );
}
