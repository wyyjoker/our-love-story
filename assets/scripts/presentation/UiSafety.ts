export type Insets = { top: number; bottom: number; left: number; right: number };

/** Presentation geometry only: align centres/feet near a neighbour or scene edge. */
export function snapFurniturePlacement(x: number, y: number, width: number, height: number, others: readonly { x: number; foot: number }[], area = { width: 670, height: 580 }) {
  const edgeX = area.width / 2, edgeY = area.height / 2;
  const halfW = Math.min(edgeX, width / 2), halfH = Math.min(edgeY, height / 2);
  const bounded = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const bx = bounded(x, -edgeX + halfW, edgeX - halfW), by = bounded(y, -edgeY + halfH, edgeY - halfH);
  const snap = (v: number, anchors: number[], min: number, max: number) => {
    const candidates = anchors.filter(a => a >= min && a <= max && Math.abs(a - v) <= 8).sort((a, b) => Math.abs(a - v) - Math.abs(b - v));
    return candidates[0] ?? v;
  };
  const sx = snap(bx, [-edgeX + halfW, 0, edgeX - halfW, ...others.map(o => o.x)], -edgeX + halfW, edgeX - halfW);
  const sy = snap(by, [-edgeY + halfH, edgeY - halfH, ...others.map(o => o.foot + halfH)], -edgeY + halfH, edgeY - halfH);
  const alignedX = [-edgeX + halfW, 0, edgeX - halfW, ...others.map(o => o.x)].some(a => Math.abs(a - sx) < .01);
  const alignedY = [-edgeY + halfH, edgeY - halfH, ...others.map(o => o.foot + halfH)].some(a => Math.abs(a - sy) < .01);
  return { x: sx, y: sy, snappedX: sx !== bx, snappedY: sy !== by, guideX: alignedX ? sx : null, guideY: alignedY ? sy - halfH : null };
}

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

/** Allocate chrome around a 7x9 square-cell board, using surplus space for the customers. */
export function mergePageLayout(width: number, height: number) {
  const compact = height < 1550;
  let statusHeight = compact ? 88 : 144, footerHeight = compact ? 84 : 110;
  const toolbarHeight = compact ? 0 : 52, gap = 2;
  const fullCell = Math.max(1, (width - 68) / 7);
  let cellSize = fullCell;
  let gridHeight = cellSize * 9 + gap * 8;
  let orderHeight = height - gridHeight - toolbarHeight - statusHeight - footerHeight - 88;
  const minimumOrder = compact ? 208 : 136;
  if (orderHeight < minimumOrder) {
    statusHeight = compact ? 88 : statusHeight; footerHeight = compact ? 84 : footerHeight; orderHeight = minimumOrder;
    cellSize = Math.max(1, Math.min(fullCell, (height - statusHeight - footerHeight - orderHeight - toolbarHeight - 88 - 8 * gap) / 9));
    gridHeight = cellSize * 9 + gap * 8;
  }
  const breathing = Math.max(0, orderHeight - 390); orderHeight = Math.min(390, orderHeight);
  const boardHeight = gridHeight + toolbarHeight + 32;
  const boardBottom = 28 + footerHeight;
  return { statusHeight, footerHeight, orderHeight, toolbarHeight, cellSize, gap, boardHeight, boardBottom,
    orderTop: 20 + statusHeight + breathing, boardTop: height - boardBottom - boardHeight };
}

export function photoPage(paths: readonly string[], requestedPage: number) {
  const pages = Math.max(1, Math.ceil(paths.length / 4));
  const page = Math.max(0, Math.min(pages - 1, Math.floor(requestedPage) || 0));
  const first = page * 4;
  return { page, pages, photos: paths.slice(first, first + 4).map((path, offset) => ({ path, index: first + offset })) };
}

/** Leave the status bar and bottom navigation outside the life-page content. */
export const LIFE_TOP_RESERVED = 156;
export const LIFE_BOTTOM_RESERVED = 144;

export function lifePageLayout(width: number, height: number) {
  const top = height / 2 - LIFE_TOP_RESERVED;
  const bottom = -height / 2 + LIFE_BOTTOM_RESERVED;
  return { y: (top + bottom) / 2, scale: Math.min(1, (top - bottom) / 1000, (width - 24) / 710) };
}
export function homeFurnitureLayout(width: number, height: number) {
  const page = lifePageLayout(width, height);
  const headerBottom = height / 2 - 12 - mergePageLayout(width, height).statusHeight;
  const tabsY = (headerBottom - 10 - page.y) / page.scale - 39;
  const top = tabsY - 118, bottom = -290 - Math.max(0, height - 1334) * .09;
  return { tabsY, width: 700, height: top - bottom, y: (top + bottom) / 2 };
}

export function journalLayout(width: number, height: number) {
  const scale = lifePageLayout(width, height).scale;
  const compact = scale < 0.94;
  return { compact, perPage: compact ? 1 : 4,
    extra: compact ? 0 : Math.max(0, ((height - LIFE_TOP_RESERVED - LIFE_BOTTOM_RESERVED) / scale - 1000) / 2) };
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
