// Camera acquisition is bounded: browsers may leave permission requests pending.
export function cameraErrorMessage(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'Camera access is blocked. Allow Camera in this site’s browser settings and your device’s privacy settings, then tap Try again.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found. Connect or enable a camera, then tap Try again.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is busy or unavailable. Close other camera apps and tabs, check the camera connection, then tap Try again.';
    case 'TimeoutError':
      return 'The camera did not respond. Accept the browser’s Camera permission prompt, then tap Try again. If no prompt appears, open this kiosk directly in Safari, Chrome, or Edge.';
    case 'NotSupportedError':
      return 'This browser cannot open the camera. Open the kiosk’s HTTPS link directly in Safari, Chrome, or Edge.';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'This camera could not use the requested settings. Check the camera connection, then tap Try again.';
    default:
      return 'The camera did not start. Check camera permissions and close other camera apps, then tap Try again.';
  }
}

export async function startCameraPreview({
  video, mediaDevices = globalThis.navigator?.mediaDevices, signal, timeoutMs = 15000,
}) {
  if (!mediaDevices?.getUserMedia) {
    throw new DOMException('Camera API unavailable', 'NotSupportedError');
  }
  if (signal?.aborted) throw new DOMException('Camera cancelled', 'AbortError');
  let stream;
  let stopped = false;
  let cancel;
  const cancelled = new Promise((_, reject) => { cancel = reject; });
  const stop = (reason) => {
    stopped = true;
    cancel(reason);
  };
  const onAbort = () => stop(new DOMException('Camera cancelled', 'AbortError'));
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => stop(new DOMException('Camera startup timed out', 'TimeoutError')), timeoutMs);
  const wait = (pending) => Promise.race([pending, cancelled]);
  const release = (value) => value?.getTracks().forEach((track) => track.stop());
  const request = (constraints) => wait(Promise.resolve().then(() => {
    if (stopped) throw new DOMException('Camera cancelled', 'AbortError');
    return mediaDevices.getUserMedia(constraints);
  }).then((value) => {
    // getUserMedia cannot be aborted. Release a late permission grant immediately.
    if (stopped) {
      release(value);
      throw new DOMException('Camera cancelled', 'AbortError');
    }
    return value;
  }));
  try {
    try {
      stream = await request({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
    } catch (error) {
      if (!['OverconstrainedError', 'ConstraintNotSatisfiedError', 'NotFoundError'].includes(error.name)) throw error;
      stream = await request({ video: true, audio: false });
    }
    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState === 'ended') throw new DOMException('No live camera track', 'NotReadableError');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await wait(Promise.resolve(video.play()));
    while (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      if (track.readyState === 'ended') throw new DOMException('Camera disconnected', 'NotReadableError');
      await wait(new Promise((resolve) => setTimeout(resolve, 50)));
    }
    // Zoom is optional. Unsupported or stalled controls must not block a usable preview.
    try {
      const zoom = track.getCapabilities?.().zoom;
      if (zoom && track.applyConstraints) {
        const min = Number.isFinite(zoom.min) ? zoom.min : 1;
        Promise.resolve(track.applyConstraints({ advanced: [{ zoom: min }] })).catch(() => {});
      }
    } catch {}
    return stream;
  } catch (error) {
    stopped = true;
    release(stream);
    if (stream && video.srcObject === stream) video.srcObject = null;
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
