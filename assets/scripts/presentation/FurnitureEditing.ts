export type FurniturePose = { x: number; y: number; scale?: number; rotation?: number; flipped?: boolean };
export const FURNITURE_SCALE = { min: .5, max: 1.8 } as const;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function furnitureScaleFromProgress(progress: number): number {
  return Math.round((FURNITURE_SCALE.min + clamp(Number.isFinite(progress) ? progress : 0, 0, 1) * (FURNITURE_SCALE.max - FURNITURE_SCALE.min)) * 100) / 100;
}
export function furnitureScaleProgress(scale: number): number {
  return clamp((scale - FURNITURE_SCALE.min) / (FURNITURE_SCALE.max - FURNITURE_SCALE.min), 0, 1);
}
export function rotatedFurnitureSize(width: number, height: number, scale: number, rotation: number) {
  const angle = rotation * Math.PI / 180;
  return { width: (Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle))) * scale,
    height: (Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle))) * scale };
}
export function constrainFurniturePose(pose: FurniturePose, size: { width: number; height: number }, area: { width: number; height: number }) {
  const scale = clamp(pose.scale ?? 1, FURNITURE_SCALE.min, FURNITURE_SCALE.max), rotation = pose.rotation ?? 0;
  const bounds = rotatedFurnitureSize(size.width, size.height, scale, rotation);
  const halfW = Math.min(area.width / 2, bounds.width / 2), halfH = Math.min(area.height / 2, bounds.height / 2);
  return { x: clamp((pose.x - .5) * area.width, -area.width / 2 + halfW, area.width / 2 - halfW) / area.width + .5,
    y: clamp((pose.y - .5) * area.height, -area.height / 2 + halfH, area.height / 2 - halfH) / area.height + .5,
    scale, rotation, flipped: pose.flipped ?? false };
}
/** Inverse rotation avoids selecting an empty corner of a rotated bounding box. */
export function furnitureContainsPoint(point: { x: number; y: number }, centre: { x: number; y: number }, size: { width: number; height: number }, scale: number, rotation: number): boolean {
  const angle = rotation * Math.PI / 180, dx = point.x - centre.x, dy = point.y - centre.y;
  return scale > 0 && Math.abs((dx * Math.cos(angle) + dy * Math.sin(angle)) / scale) <= size.width / 2
    && Math.abs((-dx * Math.sin(angle) + dy * Math.cos(angle)) / scale) <= size.height / 2;
}
