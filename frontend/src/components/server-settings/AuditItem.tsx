import { AUDIT_ACTION_LABEL, SERVER_FIELD_LABEL } from "../../constants/server-settings";
import { formatDateTime, nameOf } from "../../lib/utils";
import type { AuditItemProps } from "../../types/ui.types";
import { ChatAvatar } from "../chat/ChatAvatar";

/** "ana expulsou bruno" plus what changed: role, fields or rule count. */
export function AuditItem({ entry }: AuditItemProps) {
  const { actor, target, details } = entry;
  const extra = [
    details?.roleName && `cargo ${details.roleName}`,
    details?.fields?.length && details.fields.map((f) => SERVER_FIELD_LABEL[f] ?? f).join(", "),
    details?.count !== undefined && `${details.count} regras`,
  ].filter(Boolean);

  return (
    <li className="audit-item" data-action={entry.action}>
      {actor ? <ChatAvatar user={actor} /> : <span className="chat-avatar" aria-hidden>?</span>}
      <p>
        <strong>{actor ? nameOf(actor) : "Conta apagada"}</strong> {AUDIT_ACTION_LABEL[entry.action]}
        {target && (
          <>
            {" "}
            <strong>{nameOf(target)}</strong>
          </>
        )}
        {extra.length > 0 && <span className="audit-item-extra"> · {extra.join(" · ")}</span>}
      </p>
      <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
    </li>
  );
}
