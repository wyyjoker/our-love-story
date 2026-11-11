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
    const value = sys.localStorage.getItem(key);
    return value == null ? null : String(value);
  }

  setItem(key: string, value: string): void {
    sys.localStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    sys.localStorage.removeItem(key);
  }
}
