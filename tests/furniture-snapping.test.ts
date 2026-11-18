import { expect, it } from 'vitest';
import { homeFurnitureLayout, lifePageLayout, mergePageLayout, snapFurniturePlacement } from '../assets/scripts/presentation/UiSafety';
it('snaps nearby furniture centres and feet without moving a distant placement', () => {
  expect(snapFurniturePlacement(4, 27, 100, 80, [{ x: 0, foot: -10 }])).toMatchObject({ x: 0, y: 30, snappedX: true, snappedY: true });
  expect(snapFurniturePlacement(112, 103, 100, 80, [])).toMatchObject({ x: 112, y: 103, snappedX: false, snappedY: false });
});
it('keeps large, rotated bounding rectangles within the scene even when aligning', () => {
  expect(snapFurniturePlacement(1000, -1000, 400, 300, [{ x: 220, foot: -280 }])).toMatchObject({ x: 135, y: -140 });
  expect(snapFurniturePlacement(1000, -1000, 900, 900, [])).toMatchObject({ x: 0, y: 0 });
});
it('moves room tabs directly below the header and expands placement on tall screens', () => {
  for (const height of [1134, 1334, 1626]) {
    const area = homeFurnitureLayout(750, height), page = lifePageLayout(750, height);
    const headerBottom = height / 2 - 12 - mergePageLayout(750, height).statusHeight;
    expect(headerBottom - (page.y + (area.tabsY + 39) * page.scale)).toBeCloseTo(10);
    expect(area.height).toBeGreaterThan(580); expect(area.width).toBeGreaterThan(670);
    const moved = snapFurniturePlacement(1000, 1000, 100, 100, [], area);
    expect(moved.x).toBeLessThanOrEqual(area.width / 2 - 50); expect(moved.y).toBeLessThanOrEqual(area.height / 2 - 50);
  }
});
