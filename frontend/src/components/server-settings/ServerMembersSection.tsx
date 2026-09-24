import { useServerMembers } from "../../hooks/useServerMembers";
import { formatDate, nameOf } from "../../lib/utils";
import type { ServerSettingsSectionProps } from "../../types/ui.types";
import { FormError } from "../shared/FormError";
import { ServerMemberRow } from "./ServerMemberRow";

export function ServerMembersSection({ server, permissions }: ServerSettingsSectionProps) {
  const list = useServerMembers(server, permissions);

  return (
    <div className="settings-stack">
      <section className="settings-form">
        <h2>Membros — {list.total}</h2>
        <input
          type="search"
          className="server-members-search"
          placeholder="Buscar por nome ou @usuário"
          aria-label="Buscar membro"
          value={list.search}
          onChange={(event) => list.setSearch(event.target.value)}
        />
        {list.canManageRoles && (
          <p className="settings-hint">Clique num cargo para dar ou tirar do membro.</p>
        )}
        <FormError message={list.error} />
        {list.loading ? (
          <p className="settings-hint">Carregando...</p>
        ) : list.members.length ? (
          <ul className="server-member-rows">
            {list.members.map((member) => (
              <ServerMemberRow key={member.id} member={member} list={list} />
            ))}
          </ul>
        ) : (
          <p className="settings-hint">Ninguém encontrado.</p>
        )}
      </section>

      {list.canBan && (
        <section className="settings-form">
          <h2>Banidos — {list.bans.length}</h2>
          {list.bans.length ? (
            <ul className="server-member-rows">
              {list.bans.map((ban) => (
                <li key={ban.user?.id ?? ban.createdAt} className="server-member-row">
                  <div className="server-member-row-head">
                    <span className="server-member-row-name">
                      <strong>{ban.user ? nameOf(ban.user) : "Conta apagada"}</strong>
                      <small>
                        Banido em {formatDate(ban.createdAt)}
                        {ban.bannedBy && ` por ${nameOf(ban.bannedBy)}`}
                      </small>
                    </span>
                    {ban.user && (
                      <div className="server-member-row-actions">
                        <button type="button" className="button button-ghost" onClick={() => list.unban(ban.user!.id)}>
                          Desbanir
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="settings-hint">Ninguém banido.</p>
          )}
        </section>
      )}
    </div>
  );
}
