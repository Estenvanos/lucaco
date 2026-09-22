import { LIMITS } from "../../constants/limits";
import { EQ_BAND_LABEL, NOISE_SUPPRESSION_LABEL } from "../../constants/settings";
import { useAudioSettings } from "../../hooks/useAudioSettings";
import type { EqBand, NoiseSuppression } from "../../types/users.types";
import { FormError } from "../shared/FormError";

export function AudioSection() {
  const audio = useAudioSettings();

  return (
    <div className="settings-form" ref={audio.stopMicTestOnLeave}>
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

      <label className="field">
        <span>Supressão de ruído</span>
        <select
          value={audio.noiseSuppression}
          onChange={(event) => audio.onNoiseSuppression(event.target.value as NoiseSuppression)}
        >
          {Object.entries(NOISE_SUPPRESSION_LABEL).map(([mode, label]) => (
            <option key={mode} value={mode}>
              {label}
            </option>
          ))}
        </select>
        <small className="settings-hint">
          Vale para chamadas e mensagens de voz. RNNoise é open source (xiph) e roda no seu navegador.
        </small>
      </label>

      <fieldset className="audio-eq">
        <legend>Equalizador do microfone</legend>
        {(Object.keys(EQ_BAND_LABEL) as EqBand[]).map((band) => (
          <label key={band}>
            <span>{EQ_BAND_LABEL[band]}</span>
            <input
              type="range"
              min={-LIMITS.eqDb}
              max={LIMITS.eqDb}
              value={audio.eq[band]}
              onChange={(event) => audio.onEqDrag(band, event.currentTarget.valueAsNumber)}
              onPointerUp={() => audio.onEqCommit(band)}
              onKeyUp={() => audio.onEqCommit(band)}
            />
            <output>
              {audio.eq[band] > 0 ? "+" : ""}
              {audio.eq[band]} dB
            </output>
          </label>
        ))}
        <div className="settings-actions">
          <button type="button" className="new-server-cancel" onClick={audio.resetEq}>
            Restaurar equalizador
          </button>
        </div>
      </fieldset>

      <div className="field">
        <span>Testar microfone</span>
        <meter className="audio-mic-level" min={0} max={1} low={0.6} high={0.9} value={audio.micTest.level} />
        <small className="settings-hint">
          Você ouve o próprio microfone já tratado na saída escolhida. Use fone para evitar microfonia.
        </small>
      </div>

      <FormError message={audio.error} />
      <div className="settings-actions">
        <button type="button" className="button" aria-pressed={audio.micTest.testing} onClick={audio.toggleMicTest}>
          {audio.micTest.testing ? "Parar teste" : "Testar microfone"}
        </button>
        <button type="button" className="new-server-cancel" onClick={audio.test}>
          Testar saída
        </button>
      </div>
    </div>
  );
}
