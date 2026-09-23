/**
 * Shared Cocos-safe storage adapter interface is in infrastructure/PlatformService.
 * This module wraps Cocos `sys.localStorage` for the native runtime.
 *
 * Keep gameplay/core free of `cc` imports.
 */
import { sys } from 'cc';

export type StorageAdapter = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export class CocosStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    try {
      const value = sys.localStorage.getItem(key);
      return value == null ? null : String(value);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      sys.localStorage.setItem(key, value);
    } catch {
      // WeChat storage quota / disabled storage — fail soft
    }
  }

  removeItem(key: string): void {
    try {
      sys.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
