import { useSyncExternalStore } from "react";
import { loadRnnoise, RnnoiseWorkletNode } from "@sapphi-red/web-noise-suppressor";
import rnnoiseWorkletUrl from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import rnnoiseWasmUrl from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseSimdWasmUrl from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";
import { canPickOutput } from "../devices/devices";
import type { UserSettings } from "../../types/users.types";
import type { MicTest, ProcessedMic } from "../../types/voice.types";

const EQ_BANDS = [
  { key: "eqLow", type: "lowshelf", frequency: 200 },
  { key: "eqMid", type: "peaking", frequency: 1000 },
  { key: "eqHigh", type: "highshelf", frequency: 4000 },
] as const;

// Fetched once, on the first mic that asks for RNNoise.
let rnnoiseWasm: Promise<ArrayBuffer> | null = null;

/**
 * The microphone the call and the voice messages send: capture -> [RNNoise] -> 3-band EQ.
 * The settings are read once: a change applies to the next capture.
 */
export async function openProcessedMic(settings: UserSettings): Promise<ProcessedMic> {
  const raw = await navigator.mediaDevices.getUserMedia({
    audio: {
      ...(settings.audioInputId && { deviceId: { exact: settings.audioInputId } }),
      echoCancellation: true,
      autoGainControl: true,
      noiseSuppression: settings.noiseSuppression === "browser",
    },
  });
  const context = new AudioContext({ sampleRate: 48_000 }); // RNNoise assumes 48 kHz
  const close = () => {
    for (const track of raw.getTracks()) track.stop();
    void context.close();
  };
  try {
    let node: AudioNode = context.createMediaStreamSource(raw);
    if (settings.noiseSuppression === "rnnoise") {
      rnnoiseWasm ??= loadRnnoise({ url: rnnoiseWasmUrl, simdUrl: rnnoiseSimdWasmUrl });
      await context.audioWorklet.addModule(rnnoiseWorkletUrl);
      node = node.connect(new RnnoiseWorkletNode(context, { maxChannels: 2, wasmBinary: await rnnoiseWasm }));
    }
    for (const band of EQ_BANDS) {
      const filter = context.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.gain.value = settings[band.key];
      node = node.connect(filter);
    }
    const destination = context.createMediaStreamDestination();
    node.connect(destination);
    await context.resume();
    return { stream: destination.stream, track: destination.stream.getAudioTracks()[0], context, close };
  } catch (error) {
    rnnoiseWasm = null; // a failed download is retried next time
    close();
    throw error;
  }
}

// Mic test in the settings: the processed mic played back on the chosen output, plus a level meter.
let micTest: MicTest = { testing: false, level: 0 };
let running: { mic: ProcessedMic; audio: HTMLAudioElement; timer: number } | null = null;
const listeners = new Set<() => void>();
const LEVEL_POLL_MS = 100;

function publish(change: Partial<MicTest>) {
  micTest = { ...micTest, ...change };
  for (const notify of listeners) notify();
}

export async function startMicTest(settings: UserSettings) {
  stopMicTest();
  const mic = await openProcessedMic(settings);
  const analyser = mic.context.createAnalyser();
  mic.context.createMediaStreamSource(mic.stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);

  const audio = new Audio();
  audio.srcObject = mic.stream;
  if (settings.audioOutputId && canPickOutput) await audio.setSinkId(settings.audioOutputId).catch(() => {});
  await audio.play();

  const timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    // RMS of speech sits around 0.05-0.2: scaled so normal talk fills most of the bar.
    publish({ level: Math.min(1, Math.sqrt(sum / samples.length) * 5) });
  }, LEVEL_POLL_MS);
  running = { mic, audio, timer };
  publish({ testing: true });
}

export function stopMicTest() {
  if (!running) return;
  window.clearInterval(running.timer);
  running.audio.pause();
  running.audio.srcObject = null;
  running.mic.close();
  running = null;
  publish({ testing: false, level: 0 });
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export const useMicTest = () => useSyncExternalStore(subscribe, () => micTest);
