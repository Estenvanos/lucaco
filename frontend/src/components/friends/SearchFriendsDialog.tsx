import { useFriendSearch } from "../../hooks/useFriendSearch";
import { initials } from "../../lib/utils";
import type { SearchFriendsDialogProps } from "../../types/ui.types";
import { Modal } from "../shared/Modal";

export function SearchFriendsDialog({ origin, onClose, onPick }: SearchFriendsDialogProps) {
  const { value, results, isFetching, total, onChange } = useFriendSearch();

  return (
    <Modal title="Buscar amigos" onClose={onClose} origin={origin}>
      {/* Enter opens the conversation with the best match. */}
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
          placeholder="Nome do amigo"
          aria-label="Nome do amigo"
          autoFocus
        />
      </form>

      <ul className="search-results" aria-busy={isFetching}>
        {results.map((user) => {
          const name = user.displayName ?? user.username;
          return (
            <li key={user.id}>
              <button type="button" className="search-result" onClick={() => onPick(user.id)}>
                <span className="search-result-icon">
                  {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span className="server-initials">{initials(name)}</span>}
                </span>
                {name}
                {user.displayName && <small className="search-result-sub">@{user.username}</small>}
              </button>
            </li>
          );
        })}
      </ul>

      {!isFetching && results.length === 0 && (
        <p className="modal-note">
          {total === 0 ? "Você ainda não tem amigos adicionados." : "Nenhum amigo com esse nome."}
        </p>
      )}
    </Modal>
  );
}
