export type StorageAdapter = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type PlatformKind = 'editor' | 'web' | 'wechat' | 'unknown';

export class PlatformService {
  readonly kind: PlatformKind;
  private readonly storage: StorageAdapter;

  constructor(storage?: StorageAdapter) {
    this.kind = detectPlatform();
    this.storage = storage ?? createDefaultStorage();
  }

  getStorage(): StorageAdapter {
    return this.storage;
  }

  isDevTools(): boolean {
    return this.kind === 'web' || this.kind === 'editor';
  }
}

function detectPlatform(): PlatformKind {
  const g = globalThis as {
    wx?: { getSystemInfoSync?: unknown };
    navigator?: { userAgent?: string };
    document?: unknown;
  };
  if (g.wx && typeof g.wx.getSystemInfoSync === 'function') {
    return 'wechat';
  }
  if (g.document !== undefined) {
    return 'web';
  }
  return 'unknown';
}

function createDefaultStorage(): StorageAdapter {
  const g = globalThis as {
    localStorage?: StorageAdapter;
    wx?: {
      getStorageSync?: (key: string) => unknown;
      setStorageSync?: (key: string, value: unknown) => void;
      removeStorageSync?: (key: string) => void;
    };
  };

  if (g.localStorage) {
    return g.localStorage;
  }

  if (g.wx?.getStorageSync && g.wx.setStorageSync) {
    const wx = g.wx;
    return {
      getItem(key) {
        const v = wx.getStorageSync?.(key);
        return typeof v === 'string' ? v : v == null ? null : String(v);
      },
      setItem(key, value) {
        wx.setStorageSync?.(key, value);
      },
      removeItem(key) {
        wx.removeStorageSync?.(key);
      },
    };
  }

  // In-memory fallback (Node tests without mock)
  const mem = new Map<string, string>();
  return {
    getItem: (key) => mem.get(key) ?? null,
    setItem: (key, value) => {
      mem.set(key, value);
    },
    removeItem: (key) => {
      mem.delete(key);
    },
  };
}
