/**
 * Safe-area insets for notch / Dynamic Island / home indicator.
 * Falls back to zero when the API is unavailable.
 */
import { view, sys } from 'cc';

export type SafeInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export class CocosSafeArea {
  getInsets(): SafeInsets {
    try {
      const safeArea = sys.getSafeAreaRect();
      const visible = view.getVisibleSize();
      // Cocos safe-area Rect uses a bottom-left origin.
      return {
        top: Math.max(0, visible.height - (safeArea.y + safeArea.height)),
        bottom: Math.max(0, safeArea.y),
        left: Math.max(0, safeArea.x),
        right: Math.max(0, visible.width - (safeArea.x + safeArea.width)),
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
