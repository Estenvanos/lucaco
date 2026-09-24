import { LIMITS } from "../../constants/limits";
import { useServerProfileForm } from "../../hooks/useServerProfileForm";
import type { ServerSettingsSectionProps } from "../../types/ui.types";
import { Button } from "../shared/Button";
import { Field } from "../shared/Field";
import { FormError } from "../shared/FormError";
import { ImagePicker } from "../shared/ImagePicker";

export function ServerProfileSection({ server }: ServerSettingsSectionProps) {
  const { form, saved, imageError, uploading } = useServerProfileForm(server.id);

  return (
    <form className="settings-form" onSubmit={form.onSubmit} onChange={form.onChange} noValidate>
      <h2>Perfil do server</h2>
      <div className="server-settings-images">
        <ImagePicker label="Banner" name="banner" shape="wide" previewUrl={server.bannerUrl} />
        <ImagePicker label="Ícone" name="icon" shape="square" previewUrl={server.iconUrl} />
      </div>
      {(uploading || imageError) && (
        <p className={imageError ? "field-error" : "settings-hint"} role="status">
          {imageError ?? "Enviando imagem..."}
        </p>
      )}
      <Field
        label="Nome"
        name="name"
        defaultValue={server.name}
        maxLength={LIMITS.serverName.max}
        error={form.errors.name}
      />
      <label className="field">
        <span>Descrição</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={server.description ?? ""}
          maxLength={LIMITS.serverDescription.max}
          aria-invalid={Boolean(form.errors.description)}
        />
        {form.errors.description && (
          <small className="field-error" role="alert">
            {form.errors.description}
          </small>
        )}
      </label>
      <Field
        label="Tag do server"
        name="tag"
        defaultValue={server.tag ?? ""}
        placeholder="Ex.: LUC"
        maxLength={LIMITS.serverTag.max}
        error={form.errors.tag}
      />
      <p className="settings-hint">De 2 a 4 letras ou números, aparece ao lado do nome. Vazio remove.</p>
      <FormError message={form.submitError} />
      <div className="settings-actions">
        {saved && <span className="settings-saved" role="status">Salvo</span>}
        <Button type="submit" loading={form.loading}>
          Salvar perfil
        </Button>
      </div>
    </form>
  );
}
