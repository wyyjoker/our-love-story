import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureHomePhoto, chooseJournalPhoto } from '../assets/scripts/platform/cocos/CocosPhotoService';

afterEach(() => vi.unstubAllGlobals());
describe('WeChat photo capture', () => {
  it('persists a picked personal diary photo before returning its path', async () => {
    const saveFile = vi.fn(({ success }) => success({ savedFilePath: 'wxfile://diary-permanent.jpg' }));
    vi.stubGlobal('wx', {
      chooseImage: ({ success }: { success: (value: { tempFilePaths: string[] }) => void }) => success({ tempFilePaths: ['wxfile://picked-temp.jpg'] }),
      getFileSystemManager: () => ({ saveFile }),
    });
    expect(await chooseJournalPhoto()).toEqual({ ok: true, path: 'wxfile://diary-permanent.jpg', albumSaved: false });
    expect(saveFile).toHaveBeenCalledWith(expect.objectContaining({ tempFilePath: 'wxfile://picked-temp.jpg' }));
  });
  it('does not use a cancelled or unsaved temporary diary photo', async () => {
    const fail = ({ fail }: { fail: (value: { errMsg: string }) => void }) => fail({ errMsg: 'cancel or storage full' });
    vi.stubGlobal('wx', { chooseImage: fail });
    expect((await chooseJournalPhoto()).ok).toBe(false);
    vi.stubGlobal('wx', {
      chooseImage: ({ success }: { success: (value: { tempFilePaths: string[] }) => void }) => success({ tempFilePaths: ['temp.jpg'] }),
      getFileSystemManager: () => ({ saveFile: fail }),
    });
    expect((await chooseJournalPhoto()).ok).toBe(false);
  });
  it('explains the unsupported Web action', async () => {
    vi.stubGlobal('wx', undefined);
    expect(await captureHomePhoto()).toEqual({ ok: false, reason: '请在微信小游戏中拍照留念' });
  });
  it('keeps the persistent local photo even when album permission is denied', async () => {
    const saveFile = vi.fn(({ success }) => success({ savedFilePath: 'wxfile://permanent.png' }));
    vi.stubGlobal('wx', {
      canvasToTempFilePath: ({ success }: { success: (value: { tempFilePath: string }) => void }) => success({ tempFilePath: 'wxfile://temp.png' }),
      getFileSystemManager: () => ({ saveFile }),
      saveImageToPhotosAlbum: ({ fail }: { fail: (value: { errMsg: string }) => void }) => fail({ errMsg: 'auth deny' }),
    });
    expect(await captureHomePhoto()).toEqual({ ok: true, path: 'wxfile://permanent.png', albumSaved: false });
    expect(saveFile).toHaveBeenCalledWith(expect.objectContaining({ tempFilePath: 'wxfile://temp.png' }));
  });
  it('does not report a saved photo when capture or persistent storage fails', async () => {
    const album = vi.fn();
    const fail = ({ fail }: { fail: (value: { errMsg: string }) => void }) => fail({ errMsg: 'storage full' });
    vi.stubGlobal('wx', { canvasToTempFilePath: fail, saveImageToPhotosAlbum: album });
    expect(await captureHomePhoto()).toEqual({ ok: false, reason: 'storage full' });
    vi.stubGlobal('wx', {
      canvasToTempFilePath: ({ success }: { success: (value: { tempFilePath: string }) => void }) => success({ tempFilePath: 'temp.png' }),
      getFileSystemManager: () => ({ saveFile: fail }), saveImageToPhotosAlbum: album,
    });
    expect(await captureHomePhoto()).toEqual({ ok: false, reason: 'storage full' });
    expect(album).not.toHaveBeenCalled();
  });
  it('reports successful persistence and album export separately', async () => {
    vi.stubGlobal('wx', {
      canvasToTempFilePath: ({ success }: { success: (value: { tempFilePath: string }) => void }) => success({ tempFilePath: 'temp.png' }),
      getFileSystemManager: () => ({ saveFile: ({ success }: { success: (value: { savedFilePath: string }) => void }) => success({ savedFilePath: 'saved.png' }) }),
      saveImageToPhotosAlbum: ({ success }: { success: (value: unknown) => void }) => success({}),
    });
    expect(await captureHomePhoto()).toEqual({ ok: true, path: 'saved.png', albumSaved: true });
  });
});
