import { cn, initials } from "../../lib/utils";
import type { ChatAvatarProps } from "../../types/ui.types";

export function ChatAvatar({ user, size = "sm" }: ChatAvatarProps) {
  return (
    <span className={cn("chat-avatar", size === "lg" && "chat-avatar-lg")} aria-hidden>
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user.displayName ?? user.username)}
    </span>
  );
}
