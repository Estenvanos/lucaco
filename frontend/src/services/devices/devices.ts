import { useSyncExternalStore } from "react";
import type { AudioDevices } from "../../types/users.types";

// The OS device list, as the browser exposes it (navigator.mediaDevices). One snapshot for the
// whole app, refreshed on `devicechange` (headset plugged in) and after the permission prompt.
let snapshot: AudioDevices = { inputs: [], outputs: [] };
const listeners = new Set<() => void>();

async function refresh() {
  const all = await navigator.mediaDevices.enumerateDevices();
  // "default" is the OS default under another id; the select's empty option already means that.
  const pick = (kind: MediaDeviceKind) => all.filter((d) => d.kind === kind && d.deviceId && d.deviceId !== "default");
  snapshot = { inputs: pick("audioinput"), outputs: pick("audiooutput") };
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  if (listeners.size === 1) {
    navigator.mediaDevices.addEventListener("devicechange", refresh);
    void refresh();
  }
  return () => {
    listeners.delete(notify);
    if (listeners.size === 0) navigator.mediaDevices.removeEventListener("devicechange", refresh);
  };
}

export const useAudioDevices = () => useSyncExternalStore(subscribe, () => snapshot);

/** Until the page has mic permission the browser hides device names (and Firefox most devices). */
export async function unlockDeviceLabels() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  for (const track of stream.getTracks()) track.stop();
  await refresh();
}

/** Picking the output needs HTMLMediaElement.setSinkId: Chromium and Firefox 116+, not Safari. */
export const canPickOutput = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

/** A short beep on the chosen output (null = system default). */
export async function playTestTone(outputId: string | null) {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const destination = context.createMediaStreamDestination();
  oscillator.frequency.value = 660;
  gain.gain.value = 0.15;
  oscillator.connect(gain).connect(destination);

  const audio = new Audio();
  audio.srcObject = destination.stream;
  if (outputId && canPickOutput) await audio.setSinkId(outputId);
  await audio.play();
  oscillator.start();
  oscillator.stop(context.currentTime + 0.5);
  oscillator.onended = () => {
    audio.pause();
    void context.close();
  };
}
