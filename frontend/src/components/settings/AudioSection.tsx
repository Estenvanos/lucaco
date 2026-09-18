import { useAudioSettings } from "../../hooks/useAudioSettings";
import { FormError } from "../shared/FormError";

export function AudioSection() {
  const audio = useAudioSettings();

  return (
    <div className="settings-form">
      <h2>Voz e áudio</h2>
      {audio.needsPermission && (
        <div className="settings-notice">
          <p>O navegador só mostra os nomes dos dispositivos depois que você libera o microfone.</p>
          <button type="button" className="button" onClick={audio.unlock}>
            Permitir acesso
          </button>
        </div>
      )}

      <label className="field">
        <span>Entrada (microfone)</span>
        <select value={audio.input} onChange={(event) => audio.onInput(event.target.value)}>
          <option value="">Padrão do sistema</option>
          {audio.inputs.map((device, i) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Microfone ${i + 1}`}
            </option>
          ))}
        </select>
        {audio.inputMissing && <small className="settings-hint">O microfone salvo não está conectado aqui.</small>}
      </label>

      {audio.canPickOutput ? (
        <label className="field">
          <span>Saída (alto-falante / fone)</span>
          <select value={audio.output} onChange={(event) => audio.onOutput(event.target.value)}>
            <option value="">Padrão do sistema</option>
            {audio.outputs.map((device, i) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Saída ${i + 1}`}
              </option>
            ))}
          </select>
          {audio.outputMissing && <small className="settings-hint">A saída salva não está conectada aqui.</small>}
        </label>
      ) : (
        <p className="settings-hint">Este navegador não permite escolher a saída de áudio: usa a padrão do sistema.</p>
      )}

      <FormError message={audio.error} />
      <div className="settings-actions">
        <button type="button" className="new-server-cancel" onClick={audio.test}>
          Testar saída
        </button>
      </div>
    </div>
  );
}
