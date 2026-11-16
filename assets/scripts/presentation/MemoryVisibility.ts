import type { MemoryDefinition } from '../core/types';

/** Presentation must never receive personal content for a locked story. */
export function memoryVisibility(memory: MemoryDefinition, unlocked: boolean): {
  title: string; date: string; summary: string; diary: string; art: string | null;
} {
  if (!unlocked) return { title: '尚未解锁的回忆', date: '', summary: '解锁后，这一页故事会在这里展开。', diary: '解锁这段回忆后，日记会在这里展开。', art: null };
  return { title: memory.title, date: memory.dateLabel ?? '', summary: memory.summary, diary: memory.diary, art: memory.art };
}
