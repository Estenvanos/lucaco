import { useNavigate } from "react-router";
import { ROUTES } from "../constants/routes";
import { useBlockUser, useDeclineFriend, useFriends, useSendFriendRequest } from "../services/friends/friends.api";
import { useBanMember, useKickMember, useServerPermissions, useSetAdmin } from "../services/servers/servers.api";
import { useSetMuted } from "../services/users/users.api";
import type { UserActionsMenuProps } from "../types/ui.types";
import { useAuth } from "./useAuth";

/**
 * What the right-click menu on a user may do and how. Each action takes `done`, called on success
 * (the menu closes then; on failure it stays open with the error). Destructive ones ask first.
 * The API re-checks every rule: these flags only decide what is shown.
 */
// ponytail: one menu (and its mutations) per row — fine for friend and member lists of this size;
// move to a single shared menu if lists grow to hundreds.
export function useUserActions({ user, member }: UserActionsMenuProps) {
  const me = useAuth().user!;
  const navigate = useNavigate();
  const serverId = member?.serverId ?? "";
  const { data: friends = [] } = useFriends();
  const { data: permissions = [] } = useServerPermissions(serverId);
  const sendRequest = useSendFriendRequest();
  const unfriend = useDeclineFriend();
  const block = useBlockUser();
  const setMuted = useSetMuted();
  const kick = useKickMember(serverId);
  const ban = useBanMember(serverId);
  const setAdmin = useSetAdmin(serverId);

  const isFriend = friends.some((f) => f.user.id === user.id);
  const muted = me.settings.mutedUserIds.includes(user.id);
  const iAmOwner = member?.ownerId === me.id;
  // Nobody touches the owner; only the owner touches an admin.
  const removable = Boolean(member) && member?.ownerId !== user.id && (!member?.isAdmin || iAmOwner);
  const ask = (question: string) => confirm(question); // ponytail: native confirm — swap for a Modal if the look matters
  const mutations = [sendRequest, unfriend, block, setMuted, kick, ban, setAdmin];

  return {
    isSelf: user.id === me.id,
    isFriend,
    muted,
    isAdmin: member?.isAdmin ?? false,
    canSetAdmin: iAmOwner && member?.ownerId !== user.id,
    canKick: removable && permissions.includes("KICK_MEMBERS"),
    canBan: removable && permissions.includes("BAN_MEMBERS"),
    error: mutations.find((m) => m.error)?.error?.message ?? null,
    message: (done: () => void) => {
      done();
      navigate(ROUTES.conversation(user.id));
    },
    addFriend: (done: () => void) => sendRequest.mutate({ username: user.username, message: "" }, { onSuccess: done }),
    toggleMute: (done: () => void) => setMuted.mutate({ userId: user.id, muted: !muted }, { onSuccess: done }),
    unfriend: (done: () => void) => {
      if (ask(`Desfazer amizade com ${user.name}?`)) unfriend.mutate(user.id, { onSuccess: done });
    },
    block: (done: () => void) => {
      if (ask(`Bloquear ${user.name}? Vocês deixam de ser amigos e essa pessoa não poderá te mandar mensagens.`)) {
        block.mutate(user.id, { onSuccess: done });
      }
    },
    toggleAdmin: (done: () => void) =>
      member && setAdmin.mutate({ memberId: member.memberId, admin: !member.isAdmin }, { onSuccess: done }),
    kick: (done: () => void) => {
      if (ask(`Expulsar ${user.name}? Poderá entrar de novo.`)) kick.mutate(user.id, { onSuccess: done });
    },
    ban: (done: () => void) => {
      if (ask(`Banir ${user.name}? Não poderá entrar de novo.`)) ban.mutate(user.id, { onSuccess: done });
    },
  };
}
