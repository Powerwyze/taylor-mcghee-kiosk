// Portrait window of the real camera pixels for generation.
// The on-screen preview stays letterboxed; this crop is only the upload.

export const GENERATION_JPEG_QUALITY = 0.92;
export const MIN_SHORT_SIDE = 1024;
export const MAX_GENERATION_BYTES = 4 * 1024 * 1024;
export const GUEST_JPEG_MIN_BYTES = 300 * 1024;
export const GUEST_JPEG_MAX_BYTES = 600 * 1024;
export const GUEST_JPEG_QUALITIES = [0.92, 0.86, 0.8, 0.74, 0.68, 0.62];
const PORTRAIT = 9 / 16;
const SMALL_FACE_HEIGHT = 0.12;

export function portraitCrop(srcW, srcH, focusX = srcW / 2, focusY = srcH / 2) {
  const wider = srcW / srcH > PORTRAIT;
  const cropW = wider ? Math.round(srcH * PORTRAIT) : srcW;
  const cropH = wider ? srcH : Math.round(srcW / PORTRAIT);
  const x = Math.max(0, Math.min(srcW - cropW, Math.round(focusX - cropW / 2)));
  const y = Math.max(0, Math.min(srcH - cropH, Math.round(focusY - cropH / 2)));
  return { x, y, cropW, cropH };
}

// FaceDetector boxes are sometimes in element pixels. Map them onto the frame.
export function faceCenter(box, frameW, frameH, viewW = frameW, viewH = frameH) {
  const mapped = mapFaceBox(box, frameW, frameH, viewW, viewH);
  return {
    x: Math.max(0, Math.min(frameW, mapped.x + mapped.width / 2)),
    y: Math.max(0, Math.min(frameH, mapped.y + mapped.height / 2)),
  };
}

export function mapFaceBox(box, frameW, frameH, viewW = frameW, viewH = frameH) {
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  const fitsFrame = right <= frameW + 1 && bottom <= frameH + 1;
  const fitsView = viewW > 0 && viewH > 0 && right <= viewW + 1 && bottom <= viewH + 1;
  const scaleX = (!fitsFrame || (fitsView && viewW < frameW * 0.9)) ? frameW / viewW : 1;
  const scaleY = (!fitsFrame || (fitsView && viewW < frameW * 0.9)) ? frameH / viewH : 1;
  return {
    x: box.x * scaleX,
    y: box.y * scaleY,
    width: box.width * scaleX,
    height: box.height * scaleY,
  };
}

export function isSmallFace(box, frameW, frameH) {
  if (!box || !(box.width > 0) || !(box.height > 0) || frameW <= 0 || frameH <= 0) return false;
  return box.height < frameH * SMALL_FACE_HEIGHT;
}

// Head through the visible body, with margin, as a portrait window inside the frame.
export function tightPersonCrop(frameW, frameH, face) {
  const faceH = Math.max(1, face.height);
  const faceW = Math.max(1, face.width);
  const cx = face.x + faceW / 2;
  let top = face.y - faceH * 7.2;
  let bottom = face.y + faceH + faceH * 5.5;
  const span = Math.max(faceW * 8, (bottom - top) * 0.55);
  let left = cx - span / 2;
  let right = cx + span / 2;
  const padY = (bottom - top) * 0.08;
  const padX = (right - left) * 0.08;
  top -= padY;
  bottom += padY;
  left -= padX;
  right += padX;
  top = Math.max(0, top);
  left = Math.max(0, left);
  bottom = Math.min(frameH, bottom);
  right = Math.min(frameW, right);
  let cropW = right - left;
  let cropH = bottom - top;
  if (cropW / cropH > PORTRAIT) {
    const needH = cropW / PORTRAIT;
    let y = top - (needH - cropH) / 2;
    if (y < 0) y = 0;
    if (y + needH > frameH) y = Math.max(0, frameH - needH);
    cropH = Math.min(needH, frameH - y);
    top = y;
    const maxW = cropH * PORTRAIT;
    if (cropW > maxW) {
      cropW = maxW;
      left = Math.max(0, Math.min(frameW - cropW, cx - cropW / 2));
    }
  } else {
    const needW = cropH * PORTRAIT;
    let x = left - (needW - cropW) / 2;
    if (x < 0) x = 0;
    if (x + needW > frameW) x = Math.max(0, frameW - needW);
    cropW = Math.min(needW, frameW - x);
    left = x;
    const maxH = cropW / PORTRAIT;
    if (cropH > maxH) {
      const mid = (top + bottom) / 2;
      cropH = maxH;
      top = Math.max(0, Math.min(frameH - cropH, mid - cropH / 2));
    }
  }
  return {
    x: Math.max(0, Math.round(left)),
    y: Math.max(0, Math.round(top)),
    cropW: Math.max(1, Math.round(cropW)),
    cropH: Math.max(1, Math.round(cropH)),
    tight: true,
  };
}

// Highest quality whose file lands in the guest band. Below the band, keep the
// largest file. Above the band, keep the smallest.
export function selectJpegQuality(samples) {
  const ordered = [...samples].sort((a, b) => b.quality - a.quality);
  const inBand = ordered.filter((sample) => sample.bytes >= GUEST_JPEG_MIN_BYTES && sample.bytes <= GUEST_JPEG_MAX_BYTES);
  if (inBand.length) return inBand[0];
  const underMax = ordered.filter((sample) => sample.bytes <= GUEST_JPEG_MAX_BYTES);
  if (underMax.length) return underMax[0];
  return ordered[ordered.length - 1];
}

// Keep native pixels. Upscale a tight crop so the short side is at least 1024.
// Shrink an oversized file only down to that floor.
export function generationDrawSize(cropW, cropH, byteSize = 0, options = {}) {
  let width = cropW;
  let height = cropH;
  if (options.upscale) {
    const short = Math.min(width, height);
    if (short > 0 && short < MIN_SHORT_SIDE) {
      const scale = MIN_SHORT_SIDE / short;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
  }
  const limit = options.byteLimit || GUEST_JPEG_MAX_BYTES;
  if (!byteSize || byteSize <= limit) return { width, height };
  const short = Math.min(width, height);
  if (short <= MIN_SHORT_SIDE) return { width, height };
  const fit = Math.sqrt(limit / byteSize);
  const scale = Math.max(MIN_SHORT_SIDE / short, Math.min(1, fit));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
