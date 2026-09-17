import { AuthFormFooter } from "../../components/auth/AuthFormFooter";
import { Button } from "../../components/shared/Button";
import { Field } from "../../components/shared/Field";
import { PasswordField } from "../../components/shared/PasswordField";
import { FormError } from "../../components/shared/FormError";
import { ROUTES } from "../../constants/routes";
import { useSignInForm } from "../../hooks/useSignInForm";

export function SignInPage() {
  const { errors, submitError, onSubmit, loading } = useSignInForm();

  return (
    <>
      <h2>Bem-vindo de volta</h2>
      <p className="auth-sub">Entre na sua conta para continuar.</p>
      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Email ou username"
          name="login"
          autoComplete="username"
          placeholder="voce@exemplo.com"
          error={errors.login}
        />
        <PasswordField
          label="Senha"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password}
        />
        <FormError message={submitError} />
        <Button type="submit" loading={loading}>
          Entrar
        </Button>
      </form>
      <AuthFormFooter question="Não tem conta?" to={ROUTES.signUp} action="Criar conta" />
    </>
  );
}
