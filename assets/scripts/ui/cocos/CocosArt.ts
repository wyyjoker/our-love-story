import { assetManager, AssetManager, ImageAsset, isValid, Node, Rect, Size, Sprite, SpriteFrame, Texture2D } from 'cc';
import { ensureTransform } from './CocosTheme';
import { cropPhoto, fitPhoto } from '../../presentation/UiSafety';
import type { FurnitureDefinition } from '../../core/types';

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
  if (/^scissors_0[1-5]$/.test(definitionId)) return { sheet: 'scissors_backpack_sheet', index: Number(definitionId.slice(-1)) - 1, columns: 3, rows: 2, preserveAspect: true };
  const sugarMatch = /^sugar_(0[1-3])$/.exec(definitionId);
  if (sugarMatch) return { sheet: 'special_sheet', index: Number(sugarMatch[1]) - 1, columns: 2, rows: 2 };
  if (definitionId === 'wildcard') return { sheet: 'special_sheet', index: 3, columns: 2, rows: 2 };
  const fruitMatch = /^fruit_(0[1-9]|1[0-2])$/.exec(definitionId);
  if (fruitMatch) { const level = Number(fruitMatch[1]); return level > 8
    ? { sheet: 'fruit_extra_sheet', index: level - 9, columns: 2, rows: 2, preserveAspect: true }
    : { sheet: 'fruit_sheet', index: level - 1, columns: 4, rows: 2 }; }
  const match = /^(coffee|flower|dessert|gift)_(\d{2})$/.exec(definitionId);
  if (match) {
    const level = Number(match[2]);
    if (level < 1 || level > 12) return null;
    if (level > 8) return { sheet: `${match[1]}_extra_sheet`, index: level - 9, columns: 2, rows: 2, preserveAspect: true };
    return { sheet: `${match[1]}_sheet`, index: level - 1, columns: 4, rows: 2 };
  }
  const rewardMatch = /^(coin|energy|diamond)_(0[1-5])$/.exec(definitionId);
  if (rewardMatch) {
    const level = Number(rewardMatch[2]);
    if (level > 3) {
      const index = (level - 4) * 3 + ['coin', 'energy', 'diamond'].indexOf(rewardMatch[1]);
      // Trim the atlas divider pixels, keeping only each 168px cell's artwork.
      return { sheet: 'supply_extra_sheet', region: { x: (index % 3) * 168 + 3, y: Math.floor(index / 3) * 168 + 3, width: 162, height: 162 }, preserveAspect: true };
    }
    const chainOffset = rewardMatch[1] === 'coin' ? 0 : rewardMatch[1] === 'energy' ? 4 : 8;
    return { sheet: 'treasure_sheet', index: chainOffset + Number(rewardMatch[2]) - 1, columns: 4, rows: 3 };
  }
  const chest = /^treasure_chest(?:_0([2-5]))?$/.exec(definitionId);
  if (chest) return { sheet: 'chest_levels_sheet', index: Number(chest[1] ?? 1) - 1, columns: 3, rows: 2, preserveAspect: true };
  return null;
}

export function openedChestArt(): ArtCell {
  return { sheet: 'treasure_sheet', index: 7, columns: 4, rows: 3 };
}

export function generatorArt(id: string): ArtCell | null {
  if (id === 'orange_tree') return { sheet: 'orange_tree', preserveAspect: true };
  const index = ['coffee_machine', 'flower_basket', 'dessert_oven', 'gift_box'].indexOf(id);
  // The generator atlas is 2172×724, but its vertical cell margins are wide.
  // Crop to each alpha-content bound so preserveAspect fits the actual machine.
  const regions = [
    { x: 55, y: 72, width: 488, height: 573 },
    { x: 543, y: 66, width: 543, height: 602 },
    { x: 1086, y: 117, width: 543, height: 491 },
    { x: 1631, y: 102, width: 541, height: 550 },
  ];
  return index < 0 ? null : { sheet: 'generator_sheet', region: regions[index], preserveAspect: true };
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

/** Keeps the original ten irregular furniture crops and maps new items to the 4x4 expansion atlas. */
export function furnitureArtFor(definition: Pick<FurnitureDefinition, 'id' | 'art'>, index: number): ArtCell {
  const poolMatch = /^pool:(\d+)$/.exec(definition.art);
  if (poolMatch) return { sheet: 'pool_furniture_sheet', index: Number(poolMatch[1]), columns: 4, rows: 1, preserveAspect: true };
  if (index < 10) return furnitureArt(index);
  return { sheet: 'furniture_expansion_sheet', index: index - 10, columns: 4, rows: 4, preserveAspect: true };
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
