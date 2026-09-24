import { CornerUpLeft } from "lucide-react";
import { messagePreview, nameOf } from "../../lib/utils";
import type { ReplyQuoteProps } from "../../types/ui.types";

/** The replied message above a reply; clicking it scrolls to the original when it is on screen. */
export function ReplyQuote({ original, author }: ReplyQuoteProps) {
  if (!original) {
    return (
      <p className="chat-reply-quote" data-missing>
        <CornerUpLeft aria-hidden />
        Mensagem original indisponível
      </p>
    );
  }
  return (
    <button
      type="button"
      className="chat-reply-quote"
      onClick={() => document.getElementById(`msg-${original.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
    >
      <CornerUpLeft aria-hidden />
      {author && <strong>{nameOf(author)}</strong>}
      <span>{messagePreview(original)}</span>
    </button>
  );
}
