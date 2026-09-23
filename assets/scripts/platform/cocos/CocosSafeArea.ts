/**
 * Safe-area insets for notch / Dynamic Island / home indicator.
 * Falls back to zero when the API is unavailable.
 */
import { screen, view, sys } from 'cc';

export type SafeInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export class CocosSafeArea {
  getInsets(): SafeInsets {
    try {
      const safeArea = screen.safeArea;
      if (!safeArea) {
        return this.fallbackInsets();
      }
      const visible = view.getVisibleSize();
      // safeArea is in screen coordinates (pixels from top-left of screen)
      const top = Math.max(0, safeArea.y);
      // y is distance from top in some versions; use rect fields when present
      const rect = safeArea as unknown as {
        x: number;
        y: number;
        width: number;
        height: number;
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
      };
      if (
        typeof rect.top === 'number' ||
        typeof rect.bottom === 'number'
      ) {
        return {
          top: Math.max(0, rect.top ?? 0),
          bottom: Math.max(0, rect.bottom ?? 0),
          left: Math.max(0, rect.left ?? 0),
          right: Math.max(0, rect.right ?? 0),
        };
      }

      // Approximate from rect vs visible size (screen pixels)
      const topInset = Math.max(0, rect.y);
      const bottomInset = Math.max(0, visible.height - (rect.y + rect.height));
      const leftInset = Math.max(0, rect.x);
      const rightInset = Math.max(0, visible.width - (rect.x + rect.width));
      void top;
      return {
        top: topInset,
        bottom: bottomInset,
        left: leftInset,
        right: rightInset,
      };
    } catch {
      return this.fallbackInsets();
    }
  }

  private fallbackInsets(): SafeInsets {
    // Conservative notches when API missing
    if (sys.platform === sys.Platform.IOS) {
      return { top: 44, bottom: 34, left: 0, right: 0 };
    }
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
}
