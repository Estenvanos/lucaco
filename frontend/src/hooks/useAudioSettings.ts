import { useState } from "react";
import { canPickOutput, playTestTone, unlockDeviceLabels, useAudioDevices } from "../services/devices/devices";
import { useUserSettings } from "./useUserSettings";

/**
 * Devices come from the OS through the browser; the choice is saved on the user.
 * ponytail: deviceId is per browser and origin, so on another machine the saved id is simply not
 * found and the system default is used — match by label if that becomes a pain.
 */
export function useAudioSettings() {
  const { settings, save } = useUserSettings();
  const { inputs, outputs } = useAudioDevices();
  const [error, setError] = useState<string | null>(null);

  // Found = the saved device exists here; otherwise the select shows the system default.
  const has = (list: MediaDeviceInfo[], id: string | null) => !!id && list.some((d) => d.deviceId === id);

  const input = has(inputs, settings.audioInputId) ? settings.audioInputId! : "";
  const output = has(outputs, settings.audioOutputId) ? settings.audioOutputId! : "";

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
    error,
    onInput: (id: string) => save({ audioInputId: id || null }),
    onOutput: (id: string) => save({ audioOutputId: id || null }),
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
