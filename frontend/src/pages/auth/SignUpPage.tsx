import { AuthFormFooter } from "../../components/auth/AuthFormFooter";
import { Button } from "../../components/shared/Button";
import { Field } from "../../components/shared/Field";
import { PasswordField } from "../../components/shared/PasswordField";
import { PasswordStrengthMeter } from "../../components/auth/PasswordStrengthMeter";
import { FormError } from "../../components/shared/FormError";
import { ROUTES } from "../../constants/routes";
import { useSignUpForm } from "../../hooks/useSignUpForm";

export function SignUpPage() {
  const { errors, submitError, onSubmit, loading, strength, onPasswordChange } = useSignUpForm();

  return (
    <>
      <h2>Criar conta</h2>
      <p className="auth-sub">Leva menos de um minuto.</p>
      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Username"
          name="username"
          autoComplete="username"
          placeholder="seu_nick"
          error={errors.username}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          error={errors.email}
        />
        <Field
          label="Nome de exibição (opcional)"
          name="displayName"
          placeholder="Como aparecer para os amigos"
          error={errors.displayName}
        />
        <div className="field-group">
          <PasswordField
            label="Senha"
            name="password"
            autoComplete="new-password"
            placeholder="8+ com maiúscula, número e símbolo"
            error={errors.password}
            onChange={onPasswordChange}
            aria-describedby="password-strength"
          />
          <PasswordStrengthMeter strength={strength} inputId="password" />
        </div>
        <FormError message={submitError} />
        <Button type="submit" loading={loading}>
          Criar conta
        </Button>
      </form>
      <AuthFormFooter question="Já tem conta?" to={ROUTES.signIn} action="Entrar" />
    </>
  );
}
