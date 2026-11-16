import { describe, expect, it } from 'vitest';
import { cropPhoto, fitPhoto, journalLayout, lifePageLayout, photoPage, safeContentRect } from '../assets/scripts/presentation/UiSafety';

describe('client safety calculations', () => {
  it('fills long-screen journal space and keeps short-screen cards readable', () => {
    expect(journalLayout(750, 1116)).toEqual({ compact: true, perPage: 1, extra: 0 });
    const long = journalLayout(750, 1626);
    expect(long.compact).toBe(false);
    expect(long.perPage).toBe(4);
    expect(long.extra).toBeGreaterThan(0);
    const page = lifePageLayout(750, 1626);
    expect(page.y + 500 + long.extra).toBeLessThanOrEqual(1626 / 2 - 156);
    expect(page.y - 500 - long.extra).toBeGreaterThanOrEqual(-1626 / 2 + 144);
  });
  it('crops within each atlas cell without stretching or sampling its neighbours', () => {
    const crop = cropPhoto(400, 400, 294, 158, 0.2);
    expect(crop.width / crop.height).toBeCloseTo(294 / 158);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(400);
    expect(crop.y + crop.height).toBeLessThanOrEqual(400);
    expect(crop.y).toBeLessThan(cropPhoto(400, 400, 294, 158).y);
    expect(cropPhoto(800, 400, 200, 400)).toEqual({ x: 300, y: 0, width: 200, height: 400 });
  });
  it('keeps life-page content between navigation and status on a short notched screen', () => {
    const safe = safeContentRect(750, 1334, { top: 150, bottom: 68, left: 0, right: 0 });
    const page = lifePageLayout(safe.width, safe.height);
    expect(page.y + 500 * page.scale).toBeLessThanOrEqual(safe.height / 2 - 156);
    expect(page.y - 500 * page.scale).toBeGreaterThanOrEqual(-safe.height / 2 + 144);
  });
  it('keeps the full top and bottom safe area on a notched portrait screen', () => {
    const rect = safeContentRect(750, 1626, { top: 144, bottom: 68, left: 0, right: 0 });
    expect(rect.height).toBe(1414);
    expect(rect.y + rect.height / 2).toBe(1626 / 2 - 144);
    expect(rect.y - rect.height / 2).toBe(-1626 / 2 + 68);
  });
  it('preserves asymmetric side insets and handles ordinary screens', () => {
    expect(safeContentRect(750, 1334, { top: 0, bottom: 0, left: 0, right: 0 }))
      .toEqual({ width: 750, height: 1334, x: 0, y: 0 });
    const rect = safeContentRect(750, 1334, { top: 0, bottom: 0, left: 40, right: 10 });
    expect(rect.x - rect.width / 2).toBe(-375 + 40);
    expect(rect.x + rect.width / 2).toBe(375 - 10);
  });
  it('makes all six photos reachable and clamps empty or stale page indices', () => {
    const paths = Array.from({ length: 6 }, (_, i) => `wxfile://${i}.png`);
    const first = photoPage(paths, 0);
    const last = photoPage(paths, 1);
    expect(first.photos.map((photo) => photo.index)).toEqual([0, 1, 2, 3]);
    expect(last.photos.map((photo) => photo.index)).toEqual([4, 5]);
    expect([...first.photos, ...last.photos].map((photo) => photo.path)).toEqual(paths);
    expect(photoPage(paths, 99).page).toBe(1);
    expect(photoPage([], 8)).toEqual({ page: 0, pages: 1, photos: [] });
  });
  it('fits portrait and landscape images without stretching or exceeding the frame', () => {
    const portrait = fitPhoto(750, 1626, 590, 570);
    expect(portrait.width / portrait.height).toBeCloseTo(750 / 1626);
    expect(portrait.height).toBe(570);
    expect(fitPhoto(1200, 600, 600, 600)).toEqual({ width: 600, height: 300 });
  });
});
