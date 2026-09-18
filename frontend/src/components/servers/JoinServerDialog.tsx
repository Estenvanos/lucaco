import { useJoinServerForm } from "../../hooks/useJoinServerForm";
import type { JoinServerDialogProps } from "../../types/ui.types";
import { Button } from "../shared/Button";
import { Field } from "../shared/Field";
import { FormError } from "../shared/FormError";
import { Modal } from "../shared/Modal";

export function JoinServerDialog({ onClose, onDone }: JoinServerDialogProps) {
  const form = useJoinServerForm(onDone);

  return (
    <Modal title="Entrar em um server" onClose={onClose}>
      <form onSubmit={form.onSubmit} noValidate>
        <Field
          label="ID público ou código de convite"
          name="reference"
          placeholder="ID do server ou código"
          autoFocus
          error={form.errors.reference}
        />
        <FormError message={form.submitError} />
        <Button type="submit" loading={form.loading}>
          Entrar no server
        </Button>
      </form>
      <p className="modal-note">Use o ID para um server público ou um convite para um privado.</p>
    </Modal>
  );
}
