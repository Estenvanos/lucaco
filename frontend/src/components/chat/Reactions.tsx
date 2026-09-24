import type { ReactionsProps } from "../../types/ui.types";

/** One chip per emoji with its count; mine are highlighted and clicking toggles mine. */
export function Reactions({ reactions, meId, onToggle }: ReactionsProps) {
  if (reactions.length === 0) return null;
  const byEmoji = new Map<string, string[]>(); // emoji -> who, in the order first used
  for (const r of reactions) byEmoji.set(r.emoji, [...(byEmoji.get(r.emoji) ?? []), r.userId]);
  return (
    <div className="chat-reactions">
      {[...byEmoji].map(([emoji, list]) => {
        const mine = list.includes(meId);
        return (
          <button key={emoji} type="button" className="chat-reaction" aria-pressed={mine} onClick={() => onToggle(emoji)}>
            <span aria-hidden>{emoji}</span> {list.length}
          </button>
        );
      })}
    </div>
  );
}
