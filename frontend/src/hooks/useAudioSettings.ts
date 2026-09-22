import { useState } from "react";
import { canPickOutput, playTestTone, unlockDeviceLabels, useAudioDevices } from "../services/devices/devices";
import { startMicTest, stopMicTest, useMicTest } from "../services/audio/processing";
import type { EqBand, NoiseSuppression, UserSettings } from "../types/users.types";
import { useUserSettings } from "./useUserSettings";

/** Ref callback on the section, stable so React only runs its cleanup when the section unmounts. */
const stopMicTestOnLeave = () => stopMicTest;

/**
 * Devices come from the OS through the browser; the choice is saved on the user.
 * ponytail: deviceId is per browser and origin, so on another machine the saved id is simply not
 * found and the system default is used — match by label if that becomes a pain.
 */
export function useAudioSettings() {
  const { settings, save } = useUserSettings();
  const { inputs, outputs } = useAudioDevices();
  const micTest = useMicTest();
  const [error, setError] = useState<string | null>(null);
  // Slider position while dragging: saved on release, not one request per step.
  const [eqDraft, setEqDraft] = useState<Partial<Record<EqBand, number>>>({});

  // Found = the saved device exists here; otherwise the select shows the system default.
  const has = (list: MediaDeviceInfo[], id: string | null) => !!id && list.some((d) => d.deviceId === id);

  const input = has(inputs, settings.audioInputId) ? settings.audioInputId! : "";
  const output = has(outputs, settings.audioOutputId) ? settings.audioOutputId! : "";

  const runMicTest = (next: UserSettings) => {
    setError(null);
    startMicTest(next).catch(() => setError("Não foi possível abrir o microfone para o teste."));
  };

  // A running test restarts with the new values, so the change is heard right away.
  const update = (change: Partial<UserSettings>) => {
    save(change);
    if (micTest.testing) runMicTest({ ...settings, ...change });
  };

  return {
    inputs,
    outputs,
    canPickOutput,
    // Names stay empty until the mic permission is granted.
    needsPermission: inputs.length === 0 || inputs.every((d) => !d.label),
    input,
    output,
    inputMissing: !!settings.audioInputId && inputs.length > 0 && !has(inputs, settings.audioInputId),
    outputMissing: !!settings.audioOutputId && outputs.length > 0 && !has(outputs, settings.audioOutputId),
    noiseSuppression: settings.noiseSuppression,
    eq: {
      eqLow: eqDraft.eqLow ?? settings.eqLow,
      eqMid: eqDraft.eqMid ?? settings.eqMid,
      eqHigh: eqDraft.eqHigh ?? settings.eqHigh,
    },
    micTest,
    error,
    onInput: (id: string) => update({ audioInputId: id || null }),
    onOutput: (id: string) => update({ audioOutputId: id || null }),
    onNoiseSuppression: (mode: NoiseSuppression) => update({ noiseSuppression: mode }),
    onEqDrag: (band: EqBand, db: number) => setEqDraft((draft) => ({ ...draft, [band]: db })),
    onEqCommit: (band: EqBand) => {
      const db = eqDraft[band];
      setEqDraft(({ [band]: _, ...rest }) => rest);
      if (db !== undefined && db !== settings[band]) update({ [band]: db });
    },
    resetEq: () => update({ eqLow: 0, eqMid: 0, eqHigh: 0 }),
    toggleMicTest: () => (micTest.testing ? stopMicTest() : runMicTest(settings)),
    stopMicTestOnLeave,
    unlock: () => {
      setError(null);
      unlockDeviceLabels().catch(() => setError("Permissão de microfone negada. Libere nas configurações do navegador."));
    },
    test: () => {
      setError(null);
      playTestTone(output || null).catch(() => setError("Não foi possível tocar o som de teste."));
    },
  };
}
