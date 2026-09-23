type WxCall<T> = { success: (value: T) => void; fail: (error: { errMsg?: string }) => void };

type WechatFileSystem = {
  saveFile: (options: WxCall<{ savedFilePath: string }> & { tempFilePath: string }) => void;
};

type WechatPhotoApi = {
  canvasToTempFilePath: (options: WxCall<{ tempFilePath: string }>) => void;
  saveImageToPhotosAlbum: (options: WxCall<unknown> & { filePath: string }) => void;
  getFileSystemManager: () => WechatFileSystem;
};

function wxApi(): WechatPhotoApi | null {
  return (globalThis as unknown as { wx?: WechatPhotoApi }).wx ?? null;
}

function callWx<T>(invoke: (callbacks: WxCall<T>) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    invoke({ success: resolve, fail: (error) => reject(new Error(error.errMsg ?? '照片操作失败')) });
  });
}

export type PhotoCaptureResult =
  | { ok: true; path: string; albumSaved: boolean }
  | { ok: false; reason: string };

/** Captures the current Cocos canvas and keeps a persistent local copy. */
export async function captureHomePhoto(): Promise<PhotoCaptureResult> {
  const wx = wxApi();
  if (!wx) return { ok: false, reason: '请在微信小游戏中拍照留念' };
  try {
    const temp = await callWx<{ tempFilePath: string }>((callbacks) => wx.canvasToTempFilePath(callbacks));
    const saved = await callWx<{ savedFilePath: string }>((callbacks) => wx.getFileSystemManager().saveFile({ tempFilePath: temp.tempFilePath, ...callbacks }));
    let albumSaved = true;
    try {
      await callWx<unknown>((callbacks) => wx.saveImageToPhotosAlbum({ filePath: saved.savedFilePath, ...callbacks }));
    } catch {
      albumSaved = false;
    }
    return { ok: true, path: saved.savedFilePath, albumSaved };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : '拍照失败，请再试一次' };
  }
}
