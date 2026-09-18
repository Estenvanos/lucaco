import { PasswordStrengthMeter } from "../auth/PasswordStrengthMeter";
import { useAccountForms } from "../../hooks/useAccountForms";
import { LIMITS } from "../../constants/limits";
import { Button } from "../shared/Button";
import { Field } from "../shared/Field";
import { FormError } from "../shared/FormError";
import { PasswordField } from "../shared/PasswordField";

export function AccountSection() {
  const { email, password } = useAccountForms();

  return (
    <div className="settings-stack">
      <form key={email.key} className="settings-form" onSubmit={email.onSubmit} noValidate>
        <h2>Email</h2>
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={email.current}
          maxLength={LIMITS.email.max}
          error={email.errors.email}
        />
        <PasswordField
          label="Senha atual"
          name="currentPassword"
          id="email-current-password"
          autoComplete="current-password"
          error={email.errors.currentPassword}
        />
        <FormError message={email.submitError} />
        <div className="settings-actions">
          {email.done && <span className="settings-saved" role="status">Email atualizado</span>}
          <Button type="submit" loading={email.loading}>
            Salvar email
          </Button>
        </div>
      </form>

      <form key={password.key} className="settings-form" onSubmit={password.onSubmit} noValidate>
        <h2>Senha</h2>
        <PasswordField
          label="Senha atual"
          name="currentPassword"
          id="password-current-password"
          autoComplete="current-password"
          error={password.errors.currentPassword}
        />
        <PasswordField
          label="Nova senha"
          name="newPassword"
          autoComplete="new-password"
          maxLength={LIMITS.password.max}
          onChange={password.onNewPasswordChange}
          aria-describedby="newPassword-strength"
          error={password.errors.newPassword}
        />
        <PasswordStrengthMeter strength={password.strength} inputId="newPassword" />
        <PasswordField
          label="Confirmar nova senha"
          name="confirmPassword"
          autoComplete="new-password"
          error={password.errors.confirmPassword}
        />
        <p className="settings-hint">Trocar a senha desconecta seus outros dispositivos.</p>
        <FormError message={password.submitError} />
        <div className="settings-actions">
          {password.done && <span className="settings-saved" role="status">Senha alterada</span>}
          <Button type="submit" loading={password.loading}>
            Alterar senha
          </Button>
        </div>
      </form>
    </div>
  );
}
