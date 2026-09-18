import { LIMITS } from "../../constants/limits";
import type { AddFriendFormProps } from "../../types/ui.types";
import { Button } from "../shared/Button";
import { FormError } from "../shared/FormError";

export function AddFriendForm({ form, onDiscover }: AddFriendFormProps) {
  const error = form.errors.username ?? form.errors.message;

  return (
    <div className="add-friend">
      <section>
        <h2>Adicionar amigo</h2>
        <p>Você pode adicionar amigos com o nome de usuário Lucaco deles.</p>

        <form key={form.formKey} className="add-friend-box" onSubmit={form.onSubmit} onChange={form.onChange} noValidate>
          <div className="add-friend-row">
            <input
              name="username"
              placeholder="Insira um nome de usuário"
              aria-label="Nome de usuário"
              maxLength={LIMITS.username.max}
              autoComplete="off"
              autoFocus
              aria-invalid={Boolean(form.errors.username)}
            />
            <Button type="submit" loading={form.loading}>
              Enviar pedido de amizade
            </Button>
          </div>
          <textarea
            name="message"
            rows={2}
            placeholder="Personalize sua solicitação (opcional)"
            aria-label="Mensagem do pedido"
            maxLength={LIMITS.friendRequestMessage.max}
          />
          <small className="add-friend-count" aria-live="polite">
            {LIMITS.friendRequestMessage.max - form.messageLength}
          </small>
        </form>

        {error && <p className="field-error" role="alert">{error}</p>}
        <FormError message={form.submitError} />
        {form.sentTo && (
          <p className="add-friend-sent" role="status">
            Pedido enviado para <strong>{form.sentTo}</strong>.
          </p>
        )}
        <small className="add-friend-hint">
          A mensagem chega na caixa de entrada da pessoa junto com o pedido.
        </small>
      </section>

      <section className="add-friend-more">
        <h2>Outros lugares para fazer amigos</h2>
        <p>Ninguém vem à cabeça? Confira os servers públicos, tem de tudo um pouco.</p>
        <button type="button" className="add-friend-discover" onClick={onDiscover}>
          <span>Explorar servers públicos</span>
          <span aria-hidden>›</span>
        </button>
      </section>
    </div>
  );
}
