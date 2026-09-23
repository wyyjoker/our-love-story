import { assetManager, ImageAsset, Node, Rect, resources, Size, Sprite, SpriteFrame, Texture2D } from 'cc';
import { ensureTransform } from './CocosTheme';

export type ArtCell = { sheet: string; index?: number; columns?: number; rows?: number };

const sheets = new Map<string, Promise<Texture2D | null>>();
const frames = new Map<string, SpriteFrame>();
const requests = new WeakMap<Node, string>();

function loadSheet(name: string): Promise<Texture2D | null> {
  const existing = sheets.get(name);
  if (existing) return existing;
  const promise = new Promise<Texture2D | null>((resolve) => {
    resources.load(`art/${name}/texture`, Texture2D, (error, texture) => {
      if (error || !texture) {
        console.warn(`[ART] ${name} unavailable`, error);
        resolve(null);
      } else resolve(texture);
    });
  });
  sheets.set(name, promise);
  return promise;
}

export function applyArt(node: Node, art: ArtCell, width: number, height: number): void {
  ensureTransform(node, width, height);
  const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  const token = `${art.sheet}:${art.index ?? 0}:${art.columns ?? 1}:${art.rows ?? 1}`;
  requests.set(node, token);
  const cached = frames.get(token);
  if (cached) {
    sprite.spriteFrame = cached;
    return;
  }
  void loadSheet(art.sheet).then((texture) => {
    if (!texture || !node.isValid || requests.get(node) !== token) return;
    const ready = frames.get(token);
    if (ready) {
      sprite.spriteFrame = ready;
      return;
    }
    const columns = art.columns ?? 1;
    const rows = art.rows ?? 1;
    const index = art.index ?? 0;
    if (index < 0 || index >= columns * rows) return;
    const cellW = texture.width / columns;
    const cellH = texture.height / rows;
    const cell = new SpriteFrame();
    cell.texture = texture;
    cell.rect = new Rect((index % columns) * cellW, Math.floor(index / columns) * cellH, cellW, cellH);
    cell.originalSize = new Size(cellW, cellH);
    frames.set(token, cell);
    sprite.spriteFrame = cell;
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

export function applyLocalPhoto(node: Node, path: string, width: number, height: number): void {
  ensureTransform(node, width, height);
  const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  requests.set(node, path);
  assetManager.loadRemote<ImageAsset>(path, { ext: '.png' }, (error, image) => {
    if (error || !image || !node.isValid || requests.get(node) !== path) return;
    const texture = new Texture2D();
    texture.image = image;
    const frame = new SpriteFrame();
    frame.texture = texture;
    sprite.spriteFrame = frame;
  });
}
