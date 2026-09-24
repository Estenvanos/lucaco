import { AUDIT_ACTION_LABEL, AUDIT_ACTIONS } from "../../constants/server-settings";
import { useServerAudit } from "../../hooks/useServerAudit";
import type { AuditAction } from "../../types/audit.types";
import type { ServerSettingsSectionProps } from "../../types/ui.types";
import { Button } from "../shared/Button";
import { FormError } from "../shared/FormError";
import { AuditItem } from "./AuditItem";

export function ServerAuditSection({ server }: ServerSettingsSectionProps) {
  const audit = useServerAudit(server.id);

  return (
    <section className="settings-form">
      <h2>Registro de auditoria</h2>
      <label className="field">
        <span>Ação</span>
        <select
          value={audit.action ?? ""}
          onChange={(event) => audit.setAction((event.target.value || null) as AuditAction | null)}
        >
          <option value="">Todas</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {AUDIT_ACTION_LABEL[action]}
            </option>
          ))}
        </select>
      </label>
      <FormError message={audit.error} />
      {audit.loading ? (
        <p className="settings-hint">Carregando...</p>
      ) : audit.entries.length ? (
        <ol className="audit-list">
          {audit.entries.map((entry) => (
            <AuditItem key={entry.id} entry={entry} />
          ))}
        </ol>
      ) : (
        <p className="settings-hint">Nada registrado ainda.</p>
      )}
      {audit.hasMore && (
        <div className="settings-actions">
          <Button type="button" className="button-ghost" loading={audit.loadingMore} onClick={audit.loadMore}>
            Carregar mais
          </Button>
        </div>
      )}
    </section>
  );
}
