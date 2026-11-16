import type { ClockService } from '../infrastructure/ClockService';
import { businessDayUtc8 } from '../infrastructure/ClockService';
import type { EnergyService } from './EnergyService';

export type JournalEntry = { day: number; text: string; photoPath: string; rewarded: boolean };
export type JournalState = { entries: JournalEntry[]; lastRewardDay: number | null };

export function normalizeJournal(raw: unknown): JournalState {
  const value = raw && typeof raw === 'object' ? raw as Partial<JournalState> : {};
  const entries: JournalEntry[] = [];
  if (Array.isArray(value.entries)) for (const entry of value.entries) {
    if (!entry || !Number.isSafeInteger(entry.day) || typeof entry.text !== 'string' || typeof entry.photoPath !== 'string' || entries.some((e) => e.day === entry.day)) continue;
    entries.push({ day: entry.day, text: entry.text.slice(0, 2000), photoPath: entry.photoPath, rewarded: entry.rewarded === true });
  }
  const claimed = entries.filter((entry) => entry.rewarded).map((entry) => entry.day);
  if (typeof value.lastRewardDay === 'number' && Number.isSafeInteger(value.lastRewardDay)) claimed.push(value.lastRewardDay);
  return { entries, lastRewardDay: claimed.length ? Math.max(...claimed) : null };
}

export class JournalService {
  private data: JournalState;
  constructor(raw: unknown, private readonly clock: ClockService, private readonly energy: EnergyService, private readonly onChange: () => void) { this.data = normalizeJournal(raw); }
  get state(): JournalState { return { entries: this.data.entries.map((e) => ({ ...e })), lastRewardDay: this.data.lastRewardDay }; }
  today(): JournalEntry | null { const value = this.data.entries.find((entry) => entry.day === businessDayUtc8(this.clock.now())); return value ? { ...value } : null; }
  entries(): JournalEntry[] { return this.state.entries.sort((a, b) => b.day - a.day); }
  saveToday(text: string, photoPath: string): { ok: true; energy: number; rewarded: boolean } | { ok: false; reason: 'NEED_TEXT' | 'NEED_PHOTO' | 'TOO_LONG' } {
    text = text.trim(); photoPath = photoPath.trim();
    if (!text) return { ok: false, reason: 'NEED_TEXT' };
    if (text.length > 2000) return { ok: false, reason: 'TOO_LONG' };
    if (!photoPath) return { ok: false, reason: 'NEED_PHOTO' };
    const day = businessDayUtc8(this.clock.now());
    const existing = this.data.entries.find((entry) => entry.day === day);
    const rewarded = !existing?.rewarded && (this.data.lastRewardDay === null || day > this.data.lastRewardDay);
    const amount = rewarded ? this.energy.maxEnergy : 0;
    const entry: JournalEntry = { day, text, photoPath, rewarded: !!existing?.rewarded || rewarded };
    if (existing) Object.assign(existing, entry); else this.data.entries.push(entry);
    if (rewarded) { this.data.lastRewardDay = day; this.energy.add(amount); }
    this.onChange();
    return { ok: true, energy: amount, rewarded };
  }
}
