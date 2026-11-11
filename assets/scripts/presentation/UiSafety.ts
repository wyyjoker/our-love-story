export type Insets = { top: number; bottom: number; left: number; right: number };

/** Insets are already in design units. Backgrounds still use the full canvas. */
export function safeContentRect(width: number, height: number, insets: Insets) {
  const valid = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
  const left = Math.min(width / 3, valid(insets.left));
  const right = Math.min(width / 3, valid(insets.right));
  const top = Math.min(height / 3, valid(insets.top));
  const bottom = Math.min(height / 3, valid(insets.bottom));
  return { width: width - left - right, height: height - top - bottom,
    x: (left - right) / 2, y: (bottom - top) / 2 };
}

export function photoPage(paths: readonly string[], requestedPage: number) {
  const pages = Math.max(1, Math.ceil(paths.length / 4));
  const page = Math.max(0, Math.min(pages - 1, Math.floor(requestedPage) || 0));
  const first = page * 4;
  return { page, pages, photos: paths.slice(first, first + 4).map((path, offset) => ({ path, index: first + offset })) };
}

/** Leave the status bar and bottom navigation outside the life-page content. */
export function lifePageLayout(width: number, height: number) {
  const top = height / 2 - 144;
  const bottom = -height / 2 + 104;
  return { y: (top + bottom) / 2, scale: Math.min(1, (top - bottom) / 1000, (width - 24) / 710) };
}

export function journalLayout(width: number, height: number) {
  const scale = lifePageLayout(width, height).scale;
  const compact = scale < 0.94;
  return { compact, perPage: compact ? 1 : 4,
    extra: compact ? 0 : Math.max(0, ((height - 248) / scale - 1000) / 2) };
}

export function fitPhoto(imageWidth: number, imageHeight: number, width: number, height: number) {
  const scale = Math.min(width / Math.max(1, imageWidth), height / Math.max(1, imageHeight));
  return { width: imageWidth * scale, height: imageHeight * scale };
}

export function cropPhoto(imageWidth: number, imageHeight: number, width: number, height: number, focusY = 0.5) {
  const ratio = width / height;
  const cropWidth = Math.min(imageWidth, imageHeight * ratio);
  const cropHeight = Math.min(imageHeight, imageWidth / ratio);
  return { x: (imageWidth - cropWidth) / 2, y: (imageHeight - cropHeight) * Math.max(0, Math.min(1, focusY)), width: cropWidth, height: cropHeight };
}
