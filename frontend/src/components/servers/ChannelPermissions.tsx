import { Check, Lock, Slash, X } from "lucide-react";
import { CHANNEL_PERMISSION_GROUPS } from "../../constants/permissions";
import type { OverwriteState, OverwriteTarget } from "../../types/servers.types";
import type { ChannelPermissionsProps, PermissionSwitchProps } from "../../types/ui.types";

const STATES: { value: OverwriteState; label: string; icon: typeof X }[] = [
  { value: "deny", label: "Negar", icon: X },
  { value: "inherit", label: "Herdar", icon: Slash },
  { value: "allow", label: "Permitir", icon: Check },
];

/** ✕ / ⁄ / ✓ as a radio group: one name per row, the platform handles arrow keys. */
function PermissionSwitch({ label, value, onChange }: PermissionSwitchProps) {
  return (
    <div className="permission-switch" role="radiogroup" aria-label={label}>
      {STATES.map((state) => (
        <label key={state.value} data-state={state.value} title={state.label}>
          <input
            type="radio"
            name={label}
            checked={value === state.value}
            onChange={() => onChange(state.value)}
          />
          <state.icon aria-hidden />
          <span className="sr-only">{state.label}</span>
        </label>
      ))}
    </div>
  );
}

const same = (a: OverwriteTarget, b: OverwriteTarget) => a.kind === b.kind && a.id === b.id;

export function ChannelPermissions({
  type,
  roles,
  members,
  isPrivate,
  onTogglePrivate,
  targets,
  selected,
  onSelect,
  onAdd,
  onRemove,
  stateOf,
  onChange,
}: ChannelPermissionsProps) {
  const nameOf = (target: OverwriteTarget) => {
    if (target.kind === "role") return roles.find((r) => r.id === target.id)?.name ?? "Cargo removido";
    const member = members.find((m) => m.id === target.id);
    return member ? `@${member.nickname ?? member.displayName ?? member.username}` : "Membro";
  };
  const listed = (target: OverwriteTarget) => targets.some((t) => same(t, target));
  const addableRoles = roles.filter((r) => !r.isDefault && !listed({ kind: "role", id: r.id }));
  const addableMembers = members.filter((m) => !listed({ kind: "member", id: m.id }));
  const isEveryone = selected.kind === "role" && roles.find((r) => r.id === selected.id)?.isDefault;

  return (
    <div className="channel-permissions">
      <h2>Permissões do canal</h2>
      <p className="settings-hint">Use permissões para personalizar quem pode fazer o que neste canal.</p>

      <label className="settings-toggle">
        <input type="checkbox" checked={isPrivate} onChange={(event) => onTogglePrivate(event.target.checked)} />
        <span>
          <strong>
            <Lock aria-hidden className="channel-permissions-lock" /> Canal privado
          </strong>
          <small>
            Somente administradores e os cargos ou membros liberados abaixo (Ver canal ✓) poderão ver este canal.
          </small>
        </span>
      </label>

      <h3>Permissões avançadas</h3>
      <div className="channel-permissions-grid">
        <aside className="channel-permissions-targets">
          <label className="channel-permissions-add">
            <span className="sr-only">Adicionar cargo ou membro</span>
            <select
              value=""
              onChange={(event) => {
                const [kind, id] = event.target.value.split(":") as ["role" | "member", string];
                if (id) onAdd({ kind, id });
              }}
            >
              <option value="">+ Cargo ou membro</option>
              {addableRoles.length > 0 && (
                <optgroup label="Cargos">
                  {addableRoles.map((role) => (
                    <option key={role.id} value={`role:${role.id}`}>
                      {role.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {addableMembers.length > 0 && (
                <optgroup label="Membros">
                  {addableMembers.map((member) => (
                    <option key={member.id} value={`member:${member.id}`}>
                      {member.nickname ?? member.displayName ?? member.username}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <ul>
            {targets.map((target) => (
              <li key={`${target.kind}:${target.id}`}>
                <button
                  type="button"
                  aria-current={same(target, selected)}
                  onClick={() => onSelect(target)}
                >
                  {nameOf(target)}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="channel-permissions-list">
          {CHANNEL_PERMISSION_GROUPS.filter((group) => !group.only || group.only === type).map((group) => (
            <section key={group.title}>
              <h4>{group.title}</h4>
              {group.permissions.map((permission) => (
                <div key={permission.id} className="permission-row">
                  <div>
                    <strong>{permission.label}</strong>
                    <p>{permission.description}</p>
                  </div>
                  <PermissionSwitch
                    label={permission.label}
                    value={stateOf(selected, permission.id)}
                    onChange={(state) => onChange(selected, permission.id, state)}
                  />
                </div>
              ))}
            </section>
          ))}
          {!isEveryone && (
            <button type="button" className="channel-settings-delete" onClick={() => onRemove(selected)}>
              Remover {nameOf(selected)} deste canal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
