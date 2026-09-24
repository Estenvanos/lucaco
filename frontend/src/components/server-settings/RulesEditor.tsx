import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { LIMITS } from "../../constants/limits";
import { useRulesEditor } from "../../hooks/useRulesEditor";
import type { RulesEditorProps } from "../../types/ui.types";
import { Button } from "../shared/Button";
import { FormError } from "../shared/FormError";

export function RulesEditor({ serverId, initial }: RulesEditorProps) {
  const editor = useRulesEditor(serverId, initial);

  return (
    <form
      className="settings-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        editor.submit();
      }}
    >
      <h2>Regras</h2>
      <p className="settings-hint">Todos os membros veem as regras, nesta ordem. Linhas vazias são ignoradas.</p>
      <ol className="server-rules">
        {editor.rules.map((rule, index) => (
          <li key={index}>
            <span className="server-rule-number">{index + 1}</span>
            <textarea
              aria-label={`Regra ${index + 1}`}
              rows={2}
              value={rule}
              maxLength={LIMITS.rule.max}
              onChange={(event) => editor.edit(index, event.target.value)}
            />
            <div className="server-rule-actions">
              <button type="button" title="Subir" disabled={index === 0} onClick={() => editor.move(index, -1)}>
                <ArrowUp aria-hidden />
                <span className="sr-only">Subir</span>
              </button>
              <button
                type="button"
                title="Descer"
                disabled={index === editor.rules.length - 1}
                onClick={() => editor.move(index, 1)}
              >
                <ArrowDown aria-hidden />
                <span className="sr-only">Descer</span>
              </button>
              <button type="button" title="Remover" onClick={() => editor.remove(index)}>
                <Trash2 aria-hidden />
                <span className="sr-only">Remover</span>
              </button>
            </div>
          </li>
        ))}
      </ol>
      <FormError message={editor.error} />
      <div className="settings-actions">
        {editor.saved && <span className="settings-saved" role="status">Salvo</span>}
        <Button type="button" className="button-ghost" disabled={!editor.canAdd} onClick={editor.add}>
          Adicionar regra
        </Button>
        <Button type="submit" loading={editor.saving}>
          Salvar regras
        </Button>
      </div>
    </form>
  );
}
