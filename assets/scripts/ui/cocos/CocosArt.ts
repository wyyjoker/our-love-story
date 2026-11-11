import { assetManager, AssetManager, ImageAsset, isValid, Node, Rect, Size, Sprite, SpriteFrame, Texture2D } from 'cc';
import { ensureTransform } from './CocosTheme';
import { cropPhoto, fitPhoto } from '../../presentation/UiSafety';

export type ArtCell = { sheet: string; index?: number; columns?: number; rows?: number; preserveAspect?: boolean; cropToFill?: boolean; cropFocusY?: number;
  /** Explicit pixel bounds for irregular source atlases. */
  region?: { x: number; y: number; width: number; height: number } };

const sheets = new Map<string, Promise<Texture2D | null>>();
const frames = new Map<string, SpriteFrame>();
const requests = new WeakMap<Node, string>();
let artBundle: Promise<AssetManager.Bundle | null> | undefined;

function loadArtBundle(): Promise<AssetManager.Bundle | null> {
  if (artBundle) return artBundle;
  artBundle = new Promise((resolve) => {
    assetManager.loadBundle('game_art', (error, bundle) => {
      if (error || !bundle) {
        console.warn('[ART] game_art bundle unavailable', error);
        artBundle = undefined;
        resolve(null);
      } else resolve(bundle);
    });
  });
  return artBundle;
}

function loadSheet(name: string): Promise<Texture2D | null> {
  const existing = sheets.get(name);
  if (existing) return existing;
  const promise = loadArtBundle().then((bundle) => new Promise<Texture2D | null>((resolve) => {
    if (!bundle) { resolve(null); return; }
    bundle.load(`${name}/texture`, Texture2D, (error, texture) => {
      if (error || !texture) {
        console.warn(`[ART] ${name} unavailable`, error);
        resolve(null);
      } else resolve(texture);
    });
  }));
  sheets.set(name, promise);
  void promise.then((texture) => { if (!texture) sheets.delete(name); });
  return promise;
}

export function applyArt(node: Node, art: ArtCell, width: number, height: number, onReady?: (ok: boolean) => void): void {
  ensureTransform(node, width, height);
  const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  const token = `${art.sheet}:${art.index ?? 0}:${art.columns ?? 1}:${art.rows ?? 1}${art.region ? `:rect:${art.region.x}:${art.region.y}:${art.region.width}:${art.region.height}` : ''}${art.cropToFill ? `:crop:${width / height}:${art.cropFocusY ?? 0.5}` : ''}`;
  const bind = (frame: SpriteFrame): void => {
    sprite.spriteFrame = frame;
    if (art.preserveAspect) {
      const fitted = fitPhoto(frame.originalSize.width, frame.originalSize.height, width, height);
      ensureTransform(node, fitted.width, fitted.height);
    }
    onReady?.(true);
  };
  if (requests.get(node) !== token) sprite.spriteFrame = null;
  requests.set(node, token);
  const cached = frames.get(token);
  if (cached) {
    bind(cached);
    return;
  }
  void loadSheet(art.sheet).then((texture) => {
    if (!isValid(node, true) || !isValid(sprite, true) || requests.get(node) !== token) return;
    if (!texture) { onReady?.(false); return; }
    const ready = frames.get(token);
    if (ready) {
      bind(ready);
      return;
    }
    const columns = art.columns ?? 1;
    const rows = art.rows ?? 1;
    const index = art.index ?? 0;
    if (index < 0 || index >= columns * rows) return;
    const cellW = art.region?.width ?? texture.width / columns;
    const cellH = art.region?.height ?? texture.height / rows;
    const cell = new SpriteFrame();
    cell.texture = texture;
    const crop = art.cropToFill ? cropPhoto(cellW, cellH, width, height, art.cropFocusY) : { x: 0, y: 0, width: cellW, height: cellH };
    cell.rect = new Rect((art.region?.x ?? (index % columns) * cellW) + crop.x, (art.region?.y ?? Math.floor(index / columns) * cellH) + crop.y, crop.width, crop.height);
    cell.originalSize = new Size(crop.width, crop.height);
    frames.set(token, cell);
    bind(cell);
  });
}

export function itemArt(definitionId: string): ArtCell | null {
  const match = /^(coffee|flower|dessert|gift)_(\d{2})$/.exec(definitionId);
  if (!match) return null;
  const level = Number(match[2]);
  if (level < 1 || level > 8) return null;
  return { sheet: `${match[1]}_sheet`, index: level - 1, columns: 4, rows: 2 };
}

export function generatorArt(id: string): ArtCell | null {
  const index = ['coffee_machine', 'flower_basket', 'dessert_oven', 'gift_box'].indexOf(id);
  return index < 0 ? null : { sheet: 'generator_sheet', index, columns: 4, rows: 1 };
}

// This original sheet is intentionally not a regular grid: the sofa and bed
// extend beyond equal fifths. Sample each object's own bounds to avoid clipping
// their edges or displaying part of its neighbour (notably the bedside post).
export function furnitureArt(index: number): ArtCell {
  const regions = [
    [0, 73, 470, 317], [471, 0, 312, 390], [784, 0, 386, 393],
    [1171, 34, 492, 364], [1739, 0, 244, 393],
    [0, 397, 365, 396], [368, 397, 349, 396], [720, 398, 466, 395],
    [1187, 397, 381, 396], [1569, 397, 414, 396],
  ];
  const [x, y, width, height] = regions[index] ?? regions[0];
  return { sheet: 'furniture_sheet', region: { x, y, width, height }, preserveAspect: true };
}

export function applyLocalPhoto(node: Node, path: string, width: number, height: number, onStatus?: (status: 'ready' | 'failed') => void): void {
  ensureTransform(node, width, height);
  const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  requests.set(node, path);
  const timeout = setTimeout(() => {
    if (isValid(node, true) && requests.get(node) === path) onStatus?.('failed');
  }, 8000);
  node.once(Node.EventType.NODE_DESTROYED, () => clearTimeout(timeout));
  assetManager.loadRemote<ImageAsset>(path, { ext: '.png', maxRetryCount: 0 }, (error, image) => {
    clearTimeout(timeout);
    if (!isValid(node, true) || !isValid(sprite, true) || requests.get(node) !== path) return;
    if (error || !image) { onStatus?.('failed'); return; }
    const texture = new Texture2D();
    texture.image = image;
    const frame = new SpriteFrame();
    frame.texture = texture;
    sprite.spriteFrame = frame;
    const fitted = fitPhoto(image.width, image.height, width, height);
    ensureTransform(node, fitted.width, fitted.height);
    onStatus?.('ready');
    node.once(Node.EventType.NODE_DESTROYED, () => {
      frame.destroy();
      texture.destroy();
    });
  });
}
