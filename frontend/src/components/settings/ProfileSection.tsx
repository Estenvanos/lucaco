import { useProfileForm } from "../../hooks/useProfileForm";
import { LIMITS } from "../../constants/limits";
import { Button } from "../shared/Button";
import { Field } from "../shared/Field";
import { FormError } from "../shared/FormError";
import { ImagePicker } from "../shared/ImagePicker";

export function ProfileSection() {
  const { me, form, saved, avatarError, avatarUploading } = useProfileForm();

  return (
    <form className="settings-form" onSubmit={form.onSubmit} onChange={form.onChange} noValidate>
      <h2>Perfil</h2>
      <ImagePicker
        label={avatarUploading ? "Enviando..." : "Avatar"}
        name="avatar"
        shape="square"
        previewUrl={me.avatarUrl}
        error={avatarError ?? undefined}
      />
      <Field
        label="Nome de exibição"
        name="displayName"
        defaultValue={me.displayName ?? ""}
        placeholder={me.username}
        maxLength={LIMITS.displayName.max}
        error={form.errors.displayName}
      />
      <Field
        label="Username"
        name="username"
        defaultValue={me.username}
        autoComplete="username"
        maxLength={LIMITS.username.max}
        error={form.errors.username}
      />
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
