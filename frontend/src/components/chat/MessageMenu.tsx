import { CornerUpLeft, MoreHorizontal, Trash2 } from "lucide-react";
import { useRef } from "react";
import type { MessageMenuProps } from "../../types/ui.types";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

/**
 * The "..." on a message. A native popover: the browser closes it on Esc or a click outside.
 * It sits in the top layer, so it is placed next to its button when opened.
 */
export function MessageMenu({ id, canDelete, onReply, onReact, onDelete }: MessageMenuProps) {
  const menu = useRef<HTMLDivElement>(null);
  const pick = (action: () => void) => () => {
    menu.current?.hidePopover();
    action();
  };

  return (
    <>
      <button
        type="button"
        className="chat-message-more"
        title="Mais opções"
        popoverTarget={id}
        onClick={(event) => {
          // Runs before the popover opens: anchor it under the button, or above near the bottom.
          const rect = event.currentTarget.getBoundingClientRect();
          const style = menu.current!.style;
          const below = rect.bottom < window.innerHeight / 2;
          style.top = below ? `${rect.bottom + 4}px` : "auto";
          style.bottom = below ? "auto" : `${window.innerHeight - rect.top + 4}px`;
          style.right = `${window.innerWidth - rect.right}px`;
        }}
      >
        <MoreHorizontal aria-hidden />
        <span className="sr-only">Mais opções</span>
      </button>
      <div ref={menu} id={id} popover="auto" className="chat-message-menu" role="menu">
        <div className="chat-message-menu-emojis">
          {QUICK_EMOJIS.map((emoji) => (
            <button key={emoji} type="button" role="menuitem" title={`Reagir com ${emoji}`} onClick={pick(() => onReact(emoji))}>
              {emoji}
            </button>
          ))}
        </div>
        <button type="button" role="menuitem" onClick={pick(onReply)}>
          <CornerUpLeft aria-hidden /> Responder
        </button>
        {canDelete && (
          <button type="button" role="menuitem" data-danger onClick={pick(onDelete)}>
            <Trash2 aria-hidden /> Excluir
          </button>
        )}
      </div>
    </>
  );
}
