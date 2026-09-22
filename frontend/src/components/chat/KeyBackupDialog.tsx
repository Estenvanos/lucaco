import { LIMITS } from "../../constants/limits";
import { useKeyPasswordForm } from "../../hooks/useKeyPasswordForm";
import { useKeyPrompt } from "../../services/messages/messages.key-prompt";
import type { KeyPasswordDialogProps } from "../../types/ui.types";
import { Button } from "../shared/Button";
import { FormError } from "../shared/FormError";
import { Modal } from "../shared/Modal";
import { PasswordField } from "../shared/PasswordField";

const COPY = {
  restore: {
    title: "Desbloquear mensagens",
    text: "Digite sua senha de recuperação para ler o histórico neste navegador.",
    submit: "Desbloquear",
    skip: "Esqueci a senha",
    skipNote: "Sem a senha, este navegador usa uma chave nova e o histórico antigo fica ilegível.",
  },
  create: {
    title: "Criar senha de recuperação",
    text: "Com ela você lê suas mensagens em outro navegador. Use uma senha diferente da senha de login.",
    submit: "Salvar",
    skip: "Agora não",
    skipNote: "O Lucaco não guarda essa senha: se perdê-la, o histórico não pode ser recuperado.",
  },
  upgrade: {
    title: "Ativar backup das mensagens",
    text: "Sua chave atual não pode ser copiada. Ativar o backup cria uma chave nova: as mensagens antigas deste navegador ficam ilegíveis.",
    submit: "Ativar backup",
    skip: "Agora não",
    skipNote: "Sem backup, trocar de navegador perde o histórico. Use uma senha diferente da senha de login.",
  },
} as const;

/** Mounted once in RootLayout; shows only while the E2E layer waits for a password. */
export function KeyBackupDialog() {
  const prompt = useKeyPrompt();
  // key: a new prompt (restore gave up, now create) starts with a clean form.
  return prompt && <KeyPasswordDialog key={prompt.kind} prompt={prompt} />;
}

function KeyPasswordDialog({ prompt }: KeyPasswordDialogProps) {
  const form = useKeyPasswordForm(prompt);
  const copy = COPY[prompt.kind];
  const creating = prompt.kind !== "restore";

  return (
    <Modal title={copy.title} onClose={prompt.dismiss}>
      <form onSubmit={form.onSubmit} noValidate>
        <p className="modal-note">{copy.text}</p>
        <PasswordField
          label="Senha de recuperação"
          name="password"
          autoComplete={creating ? "new-password" : "current-password"}
          maxLength={LIMITS.recoveryPassword.max}
          autoFocus
          error={form.errors.password}
        />
        {creating && (
          <PasswordField
            label="Confirmar senha"
            name="confirmPassword"
            autoComplete="new-password"
            error={form.errors.confirmPassword}
          />
        )}
        <FormError message={form.submitError} />
        <Button type="submit" loading={form.loading}>
          {copy.submit}
        </Button>
        <Button type="button" className="button-ghost" disabled={form.loading} onClick={prompt.skip}>
          {copy.skip}
        </Button>
      </form>
      <p className="modal-note">{copy.skipNote}</p>
    </Modal>
  );
}
