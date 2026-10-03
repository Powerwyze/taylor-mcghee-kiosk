import { generationDrawSize, GUEST_JPEG_MAX_BYTES, GUEST_JPEG_MIN_BYTES, GUEST_JPEG_QUALITIES, isSmallFace, mapFaceBox, MIN_SHORT_SIDE, portraitCrop, selectJpegQuality, tightPersonCrop } from './capture-crop.js';

// Browser media promises and toBlob callbacks can remain pending indefinitely.
export function bounded(operation, { signal, timeoutMs, label = 'Photo capture' }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Capture cancelled', 'AbortError'));
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      if (error) reject(error); else resolve(value);
    };
    const cancel = () => finish(new DOMException('Capture cancelled', 'AbortError'));
    const timer = setTimeout(() => finish(new DOMException(label + ' timed out', 'TimeoutError')), timeoutMs);
    signal?.addEventListener('abort', cancel, { once: true });
    Promise.resolve().then(() => {
      if (!settled) return operation();
    }).then(value => finish(null, value), error => finish(error));
  });
}

function checkCancelled(signal) {
  if (signal?.aborted) throw new DOMException('Capture cancelled', 'AbortError');
}

export async function canvasJpeg(canvas, quality, signal) {
  const blob = await bounded(
    () => new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality)),
    { signal, timeoutMs: 3000, label: 'Photo encoding' },
  );
  if (!blob?.size) throw new Error('The camera could not encode that photo.');
  return blob;
}

async function detectedFaceBox(source, signal) {
  if (typeof FaceDetector !== 'function') return null;
  try {
    const faces = await bounded(
      () => new FaceDetector({ fastMode: true, maxDetectedFaces: 3 }).detect(source),
      { signal, timeoutMs: 750, label: 'Face detection' },
    );
    if (!faces?.length) return null;
    const best = faces.reduce((chosen, face) =>
      face.boundingBox.width * face.boundingBox.height > chosen.boundingBox.width * chosen.boundingBox.height ? face : chosen);
    // The detector receives frozen canvas pixels, not a CSS-scaled video element.
    return mapFaceBox(best.boundingBox, source.width, source.height);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    console.warn('[camera] face detection unavailable; using center crop', error.name);
    return null;
  }
}

// On-screen preview only. Generation uses a native portrait crop instead of these bars.
function fitPortrait(srcW, srcH) {
  const portrait = 9 / 16;
  const wider = srcW / srcH > portrait;
  const frameW = wider ? srcW : Math.round(srcH * portrait);
  const frameH = wider ? Math.round(srcW / portrait) : srcH;
  return {
    frameW,
    frameH,
    dw: srcW,
    dh: srcH,
    dx: Math.round((frameW - srcW) / 2),
    dy: Math.round((frameH - srcH) / 2),
  };
}

function paintFrame(context, source, sx, sy, sw, sh, width, height) {
  const canvas = context.canvas;
  canvas.width = width;
  canvas.height = height;
  context.imageSmoothingEnabled = width !== sw || height !== sh;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
}

async function generationStill(source, signal) {
  const frameW = source.width;
  const frameH = source.height;
  const box = await detectedFaceBox(source, signal);
  const small = box && isSmallFace(box, frameW, frameH);
  const focus = box
    ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    : { x: frameW / 2, y: frameH / 2 };
  const crop = small ? tightPersonCrop(frameW, frameH, box) : portraitCrop(frameW, frameH, focus.x, focus.y);
  let size = generationDrawSize(crop.cropW, crop.cropH, 0, { upscale: !!small });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  let chosen = null;
  for (let grow = 0; grow < 3; grow += 1) {
    const samples = [];
    for (const quality of GUEST_JPEG_QUALITIES) {
      checkCancelled(signal);
      paintFrame(context, source, crop.x, crop.y, crop.cropW, crop.cropH, size.width, size.height);
      const blob = await canvasJpeg(canvas, quality, signal);
      if (!blob) continue;
      samples.push({ quality, bytes: blob.size, blob });
      if (blob.size <= GUEST_JPEG_MAX_BYTES) break;
    }
    const pick = selectJpegQuality(samples);
    chosen = samples.find((sample) => sample.quality === pick.quality) || samples[0];
    const short = Math.min(size.width, size.height);
    if (!chosen || chosen.bytes >= GUEST_JPEG_MIN_BYTES || short >= 1536) break;
    const scale = Math.min(1.35, 1536 / short);
    if (scale <= 1.02) break;
    size = { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
  }
  if (chosen && chosen.bytes > GUEST_JPEG_MAX_BYTES && Math.min(size.width, size.height) > MIN_SHORT_SIDE) {
    size = generationDrawSize(size.width, size.height, chosen.bytes);
    paintFrame(context, source, crop.x, crop.y, crop.cropW, crop.cropH, size.width, size.height);
    const blob = await canvasJpeg(canvas, chosen.quality, signal);
    if (blob) chosen = { ...chosen, blob, bytes: blob.size };
  }
  return chosen?.blob || null;
}

// Freeze exactly the frame at the end of the countdown before asynchronous work.
export async function captureStill(video, { signal } = {}) {
  checkCancelled(signal);
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    throw new DOMException('Camera frame unavailable', 'NotReadableError');
  }
  const frozen = document.createElement('canvas');
  frozen.width = video.videoWidth;
  frozen.height = video.videoHeight;
  frozen.getContext('2d').drawImage(video, 0, 0);
  const preview = document.createElement('canvas');
  const fit = fitPortrait(frozen.width, frozen.height);
  // A bounded preview prevents a 4K camera from allocating an enormous portrait.
  const scale = Math.min(1, 1920 / fit.frameH);
  preview.width = Math.round(fit.frameW * scale);
  preview.height = Math.round(fit.frameH * scale);
  const context = preview.getContext('2d');
  context.fillStyle = '#10182c';
  context.fillRect(0, 0, preview.width, preview.height);
  context.drawImage(frozen, fit.dx * scale, fit.dy * scale, fit.dw * scale, fit.dh * scale);
  const previewBlob = await canvasJpeg(preview, 0.9, signal);
  const blob = await generationStill(frozen, signal);
  checkCancelled(signal);
  if (!blob) throw new Error('The camera could not capture that photo.');
  return { previewBlob, blob };
}
