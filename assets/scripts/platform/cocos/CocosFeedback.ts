import { assetManager, AudioClip, AudioSource, Node } from 'cc';
import type { AssetManager } from 'cc';
import type { GamePreferences } from '../../core/types';

type FeedbackCue = 'merge' | 'reward' | 'puzzle' | 'order';
type VibrateOptions = { type?: 'light' | 'medium' | 'heavy' };
type NativeAudio = { src: string; volume: number; obeyMuteSwitch: boolean; play: () => void; stop: () => void; destroy: () => void; onError?: (callback: () => void) => void };
type WeChatRuntime = { vibrateShort?: (options?: VibrateOptions) => void; createInnerAudioContext?: () => NativeAudio };
type BrowserRuntime = { vibrate?: (pattern: number | number[]) => boolean };
type RuntimeGlobal = typeof globalThis & { wx?: WeChatRuntime; navigator?: BrowserRuntime };

const soundFiles: Record<FeedbackCue, string> = {
  merge: 'sfx_merge',
  reward: 'sfx_reward',
  puzzle: 'sfx_reward',
  order: 'sfx_order',
};

export class CocosFeedback {
  private readonly source: AudioSource;
  private readonly clips = new Map<string, AudioClip>();
  private readonly pending: FeedbackCue[] = [];
  private readonly native = new Map<string, NativeAudio>();
  private disposed = false;

  constructor(parent: Node, private readonly getPreferences: () => GamePreferences) {
    const node = new Node('FeedbackAudio');
    parent.addChild(node);
    this.source = node.addComponent(AudioSource);
    this.source.playOnAwake = false;
    this.source.volume = 1;
    this.loadAudio();
  }

  private loadAudio(): void {
    const loadFromBundle = (bundle: AssetManager.Bundle): void => {
      for (const assetName of ['sfx_merge', 'sfx_reward', 'sfx_order']) {
        bundle.load(assetName, AudioClip, (error, clip) => {
          if (error || !clip) {
            console.warn(`[SFX] ${assetName} unavailable`, error);
            return;
          }
          if (this.disposed) return;
          this.clips.set(assetName, clip);
          this.flushPending();
        });
      }
    };
    const existing = assetManager.getBundle('game_art');
    if (existing) {
      loadFromBundle(existing);
      return;
    }
    assetManager.loadBundle('game_art', (error, bundle) => {
      if (error || !bundle) {
        console.warn('[SFX] game_art bundle unavailable', error);
        return;
      }
      loadFromBundle(bundle);
    });
  }

  private flushPending(): void {
    while (this.pending.length) {
      const cue = this.pending[0];
      const clip = this.clips.get(soundFiles[cue]);
      if (!clip) return;
      this.pending.shift();
      if (this.getPreferences().soundEnabled) this.playClip(clip, cue);
    }
  }

  play(cue: FeedbackCue): void {
    const preferences = this.getPreferences();
    if (preferences.soundEnabled) {
      const clip = this.clips.get(soundFiles[cue]);
      if (clip) this.playClip(clip, cue);
      else if (this.pending.length < 4) this.pending.push(cue);
    }
    if (preferences.vibrationEnabled) this.vibrate();
  }

  private vibrate(): void {
    const runtime = globalThis as RuntimeGlobal;
    try {
      if (typeof runtime.wx?.vibrateShort === 'function') {
        runtime.wx.vibrateShort({ type: 'medium' });
        return;
      }
      runtime.navigator?.vibrate?.(35);
    } catch (error) {
      console.debug('[HAPTIC] unavailable', error);
    }
  }

  private playClip(clip: AudioClip, cue: FeedbackCue): void {
    const runtime = globalThis as RuntimeGlobal;
    const volume = cue === 'merge' ? 0.72 : cue === 'order' ? 0.62 : 0.85;
    if (runtime.wx?.createInnerAudioContext && clip.nativeUrl) {
      try {
        let player = this.native.get(soundFiles[cue]);
        if (!player) {
          player = runtime.wx.createInnerAudioContext(); player.src = clip.nativeUrl;
          player.obeyMuteSwitch = false;
          player.onError?.(() => { if (!this.disposed && this.getPreferences().soundEnabled) this.source.playOneShot(clip, volume); });
          this.native.set(soundFiles[cue], player);
        }
        player.volume = volume; player.stop(); player.play(); return;
      } catch (error) { console.debug('[SFX] native playback fallback', error); }
    }
    this.source.playOneShot(clip, volume);
  }

  dispose(): void {
    this.disposed = true;
    for (const player of this.native.values()) { player.stop(); player.destroy(); }
    this.native.clear();
    this.pending.length = 0;
    this.source.stop();
    this.source.node.destroy();
  }
}
