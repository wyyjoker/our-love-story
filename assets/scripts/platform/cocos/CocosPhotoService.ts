type WxCall<T> = { success: (value: T) => void; fail: (error: { errMsg?: string }) => void };

type WechatFileSystem = {
  saveFile: (options: WxCall<{ savedFilePath: string }> & { tempFilePath: string }) => void;
};

type WechatPhotoApi = {
  chooseImage?: (options: WxCall<{ tempFilePaths: string[] }> & { count: number; sizeType: string[]; sourceType: string[] }) => void;
  canvasToTempFilePath: (options: WxCall<{ tempFilePath: string }>) => void;
  saveImageToPhotosAlbum: (options: WxCall<unknown> & { filePath: string }) => void;
  getFileSystemManager: () => WechatFileSystem;
};

/** Selects a real personal photo and persists it before storing its path. */
export async function chooseJournalPhoto(): Promise<PhotoCaptureResult> {
  const wx = wxApi();
  if (wx?.chooseImage) {
    try {
      const picked = await callWx<{ tempFilePaths: string[] }>((callbacks) => wx.chooseImage!({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'], ...callbacks }));
      if (!picked.tempFilePaths[0]) return { ok: false, reason: '没有选中照片' };
      const saved = await callWx<{ savedFilePath: string }>((callbacks) => wx.getFileSystemManager().saveFile({ tempFilePath: picked.tempFilePaths[0], ...callbacks }));
      return { ok: true, path: saved.savedFilePath, albumSaved: false };
    } catch { return { ok: false, reason: '未添加照片，可以稍后再试' }; }
  }
  if (typeof document === 'undefined') return { ok: false, reason: '当前设备暂不支持选择照片' };
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none'; document.body.appendChild(input);
    let finished = false;
    const done = (result: PhotoCaptureResult): void => { if (finished) return; finished = true; input.remove(); resolve(result); };
    input.addEventListener('cancel', () => done({ ok: false, reason: '已取消选择照片' }), { once: true });
    input.addEventListener('change', () => {
      const file = input.files?.[0]; if (!file) return done({ ok: false, reason: '没有选中照片' });
      const url = URL.createObjectURL(file); const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas'); const ratio = Math.min(1, 720 / Math.max(image.width, image.height));
          canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio));
          const context = canvas.getContext('2d'); if (!context) throw Error('无法读取照片');
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          done({ ok: true, path: canvas.toDataURL('image/jpeg', 0.72), albumSaved: false });
        } catch { done({ ok: false, reason: '照片处理失败，请换一张照片' }); }
        finally { URL.revokeObjectURL(url); }
      };
      image.onerror = () => { URL.revokeObjectURL(url); done({ ok: false, reason: '无法读取这张照片' }); };
      image.src = url;
    }, { once: true });
    input.click();
  });
}

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
