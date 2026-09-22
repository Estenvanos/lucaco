/**
 * First frame of a video (an object URL) as a tiny webp data URL. It rides inside the encrypted
 * message (8 KB ciphertext cap), so it is dropped (null) when it does not fit or when the browser
 * cannot decode the video.
 */
export function videoThumb(url: string, maxSide = 160, maxChars = 4000): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const done = (thumb: string | null) => {
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load(); // releases the decoder
      resolve(thumb);
    };
    const timer = setTimeout(() => done(null), 5000);
    video.muted = true;
    video.preload = "auto";
    video.onerror = () => done(null);
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.1, video.duration / 2 || 0); // 0 is often a black frame
    };
    video.onseeked = () => {
      const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const thumb = canvas.toDataURL("image/webp", 0.5); // browsers without webp encode png: too big, dropped
      done(thumb.length <= maxChars ? thumb : null);
    };
    video.src = url;
  });
}
