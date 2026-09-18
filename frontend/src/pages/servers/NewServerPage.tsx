import { ImagePicker } from "../../components/servers/ImagePicker";
import { Button } from "../../components/shared/Button";
import { Field } from "../../components/shared/Field";
import { FormError } from "../../components/shared/FormError";
import { ServerCard } from "../../components/shared/ServerCard";
import { LIMITS } from "../../constants/limits";
import { SERVER_CATEGORIES } from "../../constants/server-categories";
import { useNewServer } from "../../hooks/useNewServer";

export function NewServerPage() {
  const { form, preview, cancel } = useNewServer();

  return (
    <div className="new-server">
      <form className="new-server-form" onSubmit={form.onSubmit} onChange={form.onChange} noValidate>
        <h1>Criar server</h1>

        <div className="new-server-images">
          <ImagePicker label="Banner" name="banner" shape="wide" previewUrl={preview.bannerUrl} error={form.errors.banner} />
          <ImagePicker label="Ícone" name="icon" shape="square" previewUrl={preview.iconUrl} error={form.errors.icon} />
        </div>

        <Field label="Nome do server" name="name" placeholder="Ex.: Time do sábado" autoFocus error={form.errors.name} />

        <label className="field">
          <span>Descrição</span>
          <textarea
            name="description"
            rows={3}
            maxLength={LIMITS.serverDescription.max}
            placeholder="Sobre o que é o server? Aparece na página Descobrir."
            aria-invalid={Boolean(form.errors.description)}
          />
          {form.errors.description && (
            <small className="field-error" role="alert">
              {form.errors.description}
            </small>
          )}
        </label>

        <label className="field">
          <span>Tag</span>
          <select name="category" defaultValue="other">
            {SERVER_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="visibility-field">
          <legend>Visibilidade</legend>
          <div className="visibility-options">
            <label>
              <input type="radio" name="visibility" value="public" defaultChecked />
              <span>Público</span>
            </label>
            <label>
              <input type="radio" name="visibility" value="private" />
              <span>Privado</span>
            </label>
          </div>
          <small className="new-server-hint">Públicos aparecem em Descobrir; privados só entram por convite.</small>
        </fieldset>

        <FormError message={form.submitError} />
        <div className="new-server-actions">
          <button type="button" className="new-server-cancel" onClick={cancel}>
            Cancelar
          </button>
          <Button type="submit" loading={form.loading}>
            Criar server
          </Button>
        </div>
      </form>

      <aside className="new-server-preview" aria-label="Prévia do card">
        <h2>Prévia</h2>
        <ul className="discover-grid">
          <ServerCard server={preview} joining={false} onOpen={() => {}} />
        </ul>
      </aside>
    </div>
  );
}
