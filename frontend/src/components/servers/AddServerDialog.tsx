import { useAddServer } from "../../hooks/useAddServer";
import type { AddServerDialogProps } from "../../types/ui.types";
import { Button } from "../shared/Button";
import { Field } from "../shared/Field";
import { FormError } from "../shared/FormError";
import { Modal } from "../shared/Modal";

export function AddServerDialog({ onClose, onDone }: AddServerDialogProps) {
  const { tab, setTab, createForm, joinForm } = useAddServer(onDone);

  return (
    <Modal title="Adicionar server" onClose={onClose}>
      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "create"}
          onClick={() => setTab("create")}
        >
          Criar
        </button>
        <button type="button" role="tab" aria-selected={tab === "join"} onClick={() => setTab("join")}>
          Entrar em um
        </button>
      </div>

      {tab === "create" ? (
        <form onSubmit={createForm.onSubmit} noValidate>
          <Field
            label="Nome do server"
            name="name"
            placeholder="Ex.: Time do sábado"
            autoFocus
            error={createForm.errors.name}
          />
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
            {createForm.errors.visibility && (
              <small className="field-error" role="alert">
                {createForm.errors.visibility}
              </small>
            )}
          </fieldset>
          <FormError message={createForm.submitError} />
          <Button type="submit" loading={createForm.loading}>
            Criar server
          </Button>
        </form>
      ) : (
        <form onSubmit={joinForm.onSubmit} noValidate>
          <Field
            label="ID público ou código de convite"
            name="reference"
            placeholder="ID do server ou código"
            autoFocus
            error={joinForm.errors.reference}
          />
          <FormError message={joinForm.submitError} />
          <Button type="submit" loading={joinForm.loading}>
            Entrar no server
          </Button>
        </form>
      )}

      <p className="modal-note">
        {tab === "create"
          ? "Servidores públicos aceitam entrada por ID; privados exigem convite."
          : "Use o ID para um server público ou um convite para um privado."}
      </p>
    </Modal>
  );
}
