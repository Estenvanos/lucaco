import { useState } from "react";
import { LIMITS } from "../constants/limits";
import { ApiError } from "../lib/api";
import { channelFormSchema } from "../schemas/servers.schema";
import {
  useCreateChannel,
  useDeleteChannel,
  useSaveChannelPermissions,
  useUpdateChannel,
} from "../services/servers/servers.api";
import type {
  ChannelOverwrites,
  ChannelPermission,
  ChannelSettingsTab,
  Overwrite,
  OverwriteState,
  OverwriteTarget,
} from "../types/servers.types";
import type { ChannelSettingsFormProps } from "../types/ui.types";

const EMPTY: Overwrite = { allow: [], deny: [] };
const keyOf = (target: OverwriteTarget) => `${target.kind}:${target.id}`;
const targetOf = (key: string): OverwriteTarget => {
  const [kind, id] = key.split(":") as ["role" | "member", string];
  return { kind, id };
};
const isEmpty = (ov: Overwrite) => !ov.allow.length && !ov.deny.length;
const same = (a: Overwrite, b: Overwrite) =>
  [...a.allow].sort().join() === [...b.allow].sort().join() &&
  [...a.deny].sort().join() === [...b.deny].sort().join();

function toDraft(initial: ChannelOverwrites) {
  const draft: Record<string, Overwrite> = {};
  for (const { roleId, allow, deny } of initial.roles) draft[keyOf({ kind: "role", id: roleId })] = { allow, deny };
  for (const { memberId, allow, deny } of initial.members) {
    draft[keyOf({ kind: "member", id: memberId })] = { allow, deny };
  }
  return draft;
}

/**
 * Draft of the channel screen: name, topic and every overwrite live in local state until "Salvar"
 * or "Criar canal". The component is mounted once its initial data is loaded (and keyed by the
 * channel), so the draft starts from the server's state without an effect.
 */
export function useChannelSettings({
  server,
  channel,
  type,
  everyoneRoleId,
  myMemberId,
  initial,
  canManageChannel,
  canManagePermissions,
  isAdmin,
  onClose,
  onCreated,
}: ChannelSettingsFormProps) {
  const create = useCreateChannel(server.id);
  const update = useUpdateChannel(server.id, channel?.id ?? "");
  const remove = useDeleteChannel(server.id, channel?.id ?? "");
  const savePermissions = useSaveChannelPermissions(server.id, channel?.id ?? "");

  const [tab, setTab] = useState<ChannelSettingsTab>("overview");
  const [name, setName] = useState(channel?.name ?? "");
  const [topic, setTopic] = useState(channel?.topic ?? "");
  const [userLimit, setUserLimit] = useState(String(channel?.userLimit ?? LIMITS.voiceUsers.max));
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [selected, setSelected] = useState<OverwriteTarget>({ kind: "role", id: everyoneRoleId });
  const [nameError, setNameError] = useState<string | null>(null);
  const [userLimitError, setUserLimitError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const everyoneKey = keyOf({ kind: "role", id: everyoneRoleId });
  const overwriteOf = (target: OverwriteTarget) => draft[keyOf(target)] ?? EMPTY;
  const isPrivate = overwriteOf({ kind: "role", id: everyoneRoleId }).deny.includes("VIEW_CHANNELS");

  const setOverwrite = (target: OverwriteTarget, next: Overwrite) =>
    setDraft((current) => ({ ...current, [keyOf(target)]: next }));

  const setState = (target: OverwriteTarget, permission: ChannelPermission, state: OverwriteState) => {
    const ov = overwriteOf(target);
    setOverwrite(target, {
      allow: [...ov.allow.filter((p) => p !== permission), ...(state === "allow" ? [permission] : [])],
      deny: [...ov.deny.filter((p) => p !== permission), ...(state === "deny" ? [permission] : [])],
    });
  };

  const stateOf = (target: OverwriteTarget, permission: ChannelPermission): OverwriteState => {
    const ov = overwriteOf(target);
    return ov.allow.includes(permission) ? "allow" : ov.deny.includes(permission) ? "deny" : "inherit";
  };

  /** Everyone listed on the left: @everyone first, then whoever has (or just got) an overwrite. */
  const targets = [
    { kind: "role", id: everyoneRoleId } as OverwriteTarget,
    ...Object.keys(draft)
      .filter((key) => key !== everyoneKey)
      .map(targetOf),
  ];

  const addTarget = (target: OverwriteTarget) => {
    if (!draft[keyOf(target)]) setOverwrite(target, EMPTY);
    setSelected(target);
  };

  const removeTarget = (target: OverwriteTarget) => {
    setDraft(({ [keyOf(target)]: _, ...rest }) => rest);
    setSelected({ kind: "role", id: everyoneRoleId });
  };

  /**
   * Private = @everyone denied VIEW_CHANNELS. Only admins and whoever gets an allow see it. A
   * creator who is not an admin keeps access through their own member overwrite.
   */
  const togglePrivate = (on: boolean) => {
    setState({ kind: "role", id: everyoneRoleId }, "VIEW_CHANNELS", on ? "deny" : "inherit");
    if (on && !isAdmin && !channel) {
      const me: OverwriteTarget = { kind: "member", id: myMemberId };
      const mine = overwriteOf(me);
      setOverwrite(me, { allow: [...new Set([...mine.allow, "VIEW_CHANNELS" as const])], deny: mine.deny });
    }
  };

  const changes = () => {
    const before = toDraft(initial);
    const keys = new Set([...Object.keys(before), ...Object.keys(draft)]);
    return [...keys]
      .filter((key) => !same(before[key] ?? EMPTY, draft[key] ?? EMPTY))
      .map((key) => ({ target: targetOf(key), overwrite: draft[key] ?? EMPTY }));
  };

  const fail = (err: unknown) =>
    setError(err instanceof ApiError ? err.message : "Não foi possível salvar o canal");

  const save = async () => {
    const parsed = channelFormSchema.safeParse({
      name,
      topic,
      ...(type === "voice" && { userLimit: userLimit.trim() === "" ? NaN : Number(userLimit) }),
    });
    if (!parsed.success) {
      setTab("overview");
      const issue = (field: string) => parsed.error.issues.find((i) => i.path[0] === field)?.message ?? null;
      setNameError(issue("name"));
      setUserLimitError(issue("userLimit"));
      return;
    }
    setNameError(null);
    setUserLimitError(null);
    setError(null);
    try {
      if (!channel) {
        const entries = Object.entries(draft).filter(([, ov]) => !isEmpty(ov));
        const created = await create.mutateAsync({
          ...parsed.data,
          type,
          permissions: {
            roles: entries.filter(([k]) => k.startsWith("role:")).map(([k, ov]) => ({ roleId: targetOf(k).id, ...ov })),
            members: entries
              .filter(([k]) => k.startsWith("member:"))
              .map(([k, ov]) => ({ memberId: targetOf(k).id, ...ov })),
          },
        });
        onCreated(created);
        return;
      }
      const { name: newName, topic: newTopic, userLimit: newLimit } = parsed.data;
      if (
        canManageChannel &&
        (newName !== channel.name ||
          (newTopic ?? null) !== channel.topic ||
          (newLimit ?? channel.userLimit) !== channel.userLimit)
      ) {
        await update.mutateAsync(parsed.data);
      }
      const pending = changes();
      if (canManagePermissions && pending.length) await savePermissions.mutateAsync(pending);
      onClose();
    } catch (err) {
      fail(err);
    }
  };

  const deleteChannel = () => remove.mutateAsync().then(onClose, fail);

  return {
    tab,
    setTab,
    name,
    setName,
    topic,
    setTopic,
    userLimit,
    setUserLimit,
    userLimitError,
    nameError,
    error,
    isPrivate,
    togglePrivate,
    targets,
    selected,
    select: setSelected,
    addTarget,
    removeTarget,
    stateOf,
    setState,
    save,
    saving: create.isPending || update.isPending || savePermissions.isPending,
    deleteChannel,
    deleting: remove.isPending,
  };
}
