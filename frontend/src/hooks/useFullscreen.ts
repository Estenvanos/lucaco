import { useSyncExternalStore } from "react";

const subscribe = (notify: () => void) => {
  document.addEventListener("fullscreenchange", notify);
  return () => document.removeEventListener("fullscreenchange", notify);
};

/** Browser fullscreen (Esc also exits): `toggle` puts `target` fullscreen or leaves it. */
export function useFullscreen() {
  const element = useSyncExternalStore(subscribe, () => document.fullscreenElement);
  return {
    isFullscreen: element !== null,
    toggle: (target: Element | null) => {
      if (element) void document.exitFullscreen();
      else void target?.requestFullscreen();
    },
  };
}
