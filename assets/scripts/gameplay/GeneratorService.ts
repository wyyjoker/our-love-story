import type { GeneratorDefinition, GeneratorGift, GeneratorOutput, GeneratorChargeState, GeneratorCooldownState, GeneratorBoardState, GeneratorReward, ItemInstance, PlayerState } from '../core/types';
import { consumeGeneratorUse, effectiveGeneratorState, freshGeneratorState, generatorAvailability, generatorItemId } from '../core/generator/generatorItems';
import type { ItemCatalog } from '../core/item/catalog';
import type { RandomService } from '../infrastructure/RandomService';
import { pickWeighted } from '../infrastructure/RandomService';
import type { ClockService } from '../infrastructure/ClockService';
import type { BoardService } from './BoardService';
import type { EnergyService } from './EnergyService';

export type SpawnResult = { ok: true; itemDefinitionId: string; uid: string; cellIndex: number }
  | { ok: false; reason: 'NOT_ENOUGH_ENERGY' | 'NO_CHARGES' | 'GENERATOR_COOLDOWN' | 'BOOST_UNAVAILABLE' | 'IN_PROGRESS' | 'BOARD_FULL' | 'LOCKED' | 'UNKNOWN_GENERATOR' };

/** Producers can operate only while placed on the board. */
export class GeneratorService {
  private spawning = false;
  private claiming = false;
  private readonly state: GeneratorBoardState;
  constructor(
    private readonly generators: readonly GeneratorDefinition[], private readonly catalog: ItemCatalog,
    private readonly board: BoardService, private readonly energy: EnergyService, private readonly player: PlayerState,
    private readonly random: RandomService, private readonly clock: ClockService,
    charges: Record<string, GeneratorChargeState> = {}, inventory: Record<string, number[]> = {},
    cooldowns: Record<string, GeneratorCooldownState> = {}, saved?: GeneratorBoardState,
    private readonly hasStoredGenerator: (generatorId: string) => boolean = () => false,
  ) {
    this.state = saved ? { ready: saved.ready, entitlements: [...saved.entitlements], rewards: saved.rewards.map(r => ({ ...r, state: r.state ? { ...r.state } : undefined })) }
      : { ready: false, entitlements: [], rewards: [] };
    this.state.grantedSourceIds=[...saved?.grantedSourceIds??[]];
    const migrating = !this.state.ready;
    if (migrating) { this.importLegacy(inventory, charges, cooldowns); this.state.ready = true; }
    this.ensureUnlockedCharges();
    // Bounded by board size, including when old entitlement counts are very large.
    if (migrating) while (!this.board.isFull() && this.state.rewards.length) if (!this.claimReward(this.state.rewards[0].id).ok) break;
  }
  private importLegacy(inventory: Record<string, number[]>, charges: Record<string, GeneratorChargeState>, cooldowns: Record<string, GeneratorCooldownState>): void {
    for (const gen of this.generators) {
      const counts = inventory[gen.id] ?? (this.isUnlocked(gen) && (charges[gen.id] || cooldowns[gen.id]) ? [1] : []);
      if (!counts.some(n => n > 0)) continue;
      this.state.entitlements.push(gen.id);
      let assigned = false;
      for (let level = gen.upgrade?.maxLevel ?? 1; level >= 1; level--) {
        const count = counts[level - 1] ?? 0; if (!count) continue;
        const rules = this.catalog.get(generatorItemId(gen.id, level))?.generator; if (!rules) continue;
        const now = this.clock.now();
        const empty = { ...freshGeneratorState(rules, now), remainingUses: 0, cooldownUntil: rules.cooldownMs ? now + rules.cooldownMs : null };
        if (!assigned) {
          let state = freshGeneratorState(rules, now);
          const charge = charges[gen.id], cooldown = cooldowns[gen.id];
          if (gen.recharge && charge) state = effectiveGeneratorState(rules, { ...state,
            remainingUses: Math.max(0, charge.charges + rules.capacity - (charge.capacity ?? gen.recharge.legacyCapacity ?? rules.capacity)), recoveryAt: charge.lastRecoveryAt }, now);
          else if (cooldown) state = effectiveGeneratorState(rules, { ...state, remainingUses: Math.max(0, rules.capacity - cooldown.streak),
            cooldownUntil: cooldown.cooldownStartedAt === null ? null : cooldown.cooldownStartedAt + rules.cooldownMs }, now);
          if (cooldown?.cooldownStartedAt != null && now >= cooldown.cooldownStartedAt + rules.cooldownMs) state = freshGeneratorState(rules, now);
          this.addReward(gen.id, level, 1, 'legacy', state);
          if (count > 1) this.addReward(gen.id, level, count - 1, 'legacy', empty);
          assigned = true;
        } else this.addReward(gen.id, level, count, 'legacy', empty);
      }
    }
  }
  ensureUnlockedCharges(): void {
    for (const gen of this.generators) if (this.isUnlocked(gen) && !this.state.entitlements.includes(gen.id)) {
      this.state.entitlements.push(gen.id);
      if (!this.instances(gen.id).length && !this.hasStoredGenerator(gen.id)) this.claimReward(this.addReward(gen.id, 1, 1, 'unlock').id);
    }
  }
  private addReward(generatorId: string, level: number, count: number, source: GeneratorReward['source'], state?: GeneratorReward['state']): GeneratorReward {
    const base = source + '_' + generatorId + '_' + level;
    let id = base, suffix = 0; while (this.state.rewards.some(r => r.id === id)) id = base + '_' + (++suffix);
    const reward: GeneratorReward = { id, generatorId, level, count, source, ...(state ? { state: { ...state } } : {}) };
    this.state.rewards.push(reward); return reward;
  }
  getRewards(): GeneratorReward[] { return this.state.rewards.map(r => ({ ...r, state: r.state ? { ...r.state } : undefined })); }
  getBoardState(): GeneratorBoardState { return { ready: true, entitlements: [...this.state.entitlements], rewards: this.getRewards(), grantedSourceIds:[...this.state.grantedSourceIds??[]] }; }
  grantEarned(sourceId:string, gift:GeneratorGift, source:'wish_reward'|'chapter_reward'): boolean {
    if(this.state.grantedSourceIds?.includes(sourceId))return false;
    const definition=this.get(gift.generatorId);
    if(!definition||!Number.isSafeInteger(gift.count)||gift.count<1||gift.count>8||!Number.isSafeInteger(gift.level)||gift.level<1||gift.level>(definition.upgrade?.maxLevel??1))return false;
    this.state.grantedSourceIds!.push(sourceId);
    const reward=this.addReward(gift.generatorId,gift.level,gift.count,source);
    for(let i=0;i<gift.count&&!this.board.isFull();i++)if(!this.claimReward(reward.id).ok)break;
    return true;
  }
  claimReward(id: string): { ok: true; uid: string } | { ok: false; reason: 'NOT_FOUND' | 'BOARD_FULL' | 'IN_PROGRESS' } {
    if (this.claiming) return { ok: false, reason: 'IN_PROGRESS' };
    const reward = this.state.rewards.find(r => r.id === id); if (!reward) return { ok: false, reason: 'NOT_FOUND' };
    const index = this.emptyCell(), def = this.catalog.get(generatorItemId(reward.generatorId, reward.level));
    if (index === undefined) return { ok: false, reason: 'BOARD_FULL' };
    if (!def?.generator) return { ok: false, reason: 'NOT_FOUND' };
    this.claiming = true;
    try {
      // Consume before the placement event so reentrant reads cannot grant twice.
      reward.count--;
      if (!reward.count) this.state.rewards.splice(this.state.rewards.indexOf(reward), 1);
      const item = this.board.placeAt(index, def.id, reward.state ?? freshGeneratorState(def.generator, this.clock.now()))!;
      return { ok: true, uid: item.uid };
    } finally { this.claiming = false; }
  }
  private emptyCell(): number | undefined { return [...this.board.getBoard().cells].reverse().find(c => !c.locked && !c.item)?.index; }
  private instances(id: string) { return this.board.getBoard().cells.filter(c => c.item && this.catalog.get(c.item.definitionId)?.generator?.id === id); }
  private instance(key: string): ItemInstance | undefined {
    const exact = this.board.getBoard().cells.find(c => !c.locked && c.item?.uid === key)?.item;
    if (exact && this.catalog.get(exact.definitionId)?.generator) return exact;
    return this.instances(key).filter(c => !c.locked).map(c => c.item!).sort((a,b) => this.catalog.get(b.definitionId)!.level - this.catalog.get(a.definitionId)!.level)[0];
  }
  list(): readonly GeneratorDefinition[] { return this.generators; }
  get(key: string): GeneratorDefinition | undefined {
    const direct = this.generators.find(g => g.id === key); if (direct) return direct;
    const item = this.instance(key), id = item && this.catalog.get(item.definitionId)?.generator?.id;
    return this.generators.find(g => g.id === id);
  }
  isUnlocked(gen: GeneratorDefinition): boolean { return this.player.level >= gen.unlockLevel || this.player.unlockedChainIds.includes(gen.chainId); }
  getStatus(key: string) {
    const gen = this.get(key); if (!gen) return null;
    const item = this.instance(key), def = item && this.catalog.get(item.definitionId), rules = def?.generator;
    const level = def?.level ?? 0;
    const available = rules && item ? generatorAvailability(rules, item.generatorState ?? freshGeneratorState(rules, this.clock.now()), this.clock.now()) : null;
    const boostAvailable = !!item && level > 1 && gen.energyCost > 0 && !!gen.upgrade?.levels.find(v => v.level === level)?.boostOutputs;
    return { uid: item?.uid ?? null, unlocked: !!item && this.isUnlocked(gen), level, maxLevel: gen.upgrade?.maxLevel ?? 1,
      inventory: this.counts(gen), energyCost: gen.energyCost, boostAvailable, boosted: available?.state.boosted ?? false,
      boostEnergyCost: boostAvailable ? gen.energyCost * (gen.upgrade?.boostEnergyMultiplier ?? 2) : null,
      cooldownMs: rules?.cooldownMs || rules?.recoveryIntervalMs || 0, streak: rules ? rules.capacity - (available?.state.remainingUses ?? 0) : 0,
      streakLimit: gen.streakCooldown?.uses ?? 0, remainingCooldownMs: available?.remainingCooldownMs ?? 0,
      remainingUses: available?.state.remainingUses ?? 0, capacity: rules?.capacity ?? 0,
      charges: gen.recharge && item ? available?.state.remainingUses ?? 0 : null, maxCharges: gen.recharge?.capacity ?? null, nextRecoveryMs: available?.nextRecoveryMs ?? null };
  }
  setBoost(uid: string, boosted: boolean): boolean {
    const item = this.instance(uid), status = this.getStatus(uid); if (!item || !status?.boostAvailable) return false;
    const rules = this.catalog.get(item.definitionId)!.generator!;
    item.generatorState = { ...effectiveGeneratorState(rules, item.generatorState ?? freshGeneratorState(rules, this.clock.now()), this.clock.now()), boosted }; return true;
  }
  getInventory(): Record<string, number[]> {
    return Object.fromEntries(this.generators.map(g => [g.id, this.counts(g)]));
  }
  private counts(gen: GeneratorDefinition): number[] {
    const counts=Array.from({length:gen.upgrade?.maxLevel??1},()=>0);
    for(const c of this.board.getBoard().cells){const d=c.item&&this.catalog.get(c.item.definitionId);if(d?.generator?.id===gen.id)counts[d.level-1]++;}
    return counts;
  }
  getChargeStates(): Record<string, GeneratorChargeState> { return {}; }
  getCooldownStates(): Record<string, GeneratorCooldownState> { return {}; }
  merge(id: string, level: number): { ok: true; level: number } | { ok: false; reason: 'NOT_FOUND' | 'LOCKED' | 'MAX_LEVEL' | 'NOT_ENOUGH_GENERATORS' } {
    const gen = this.get(id); if (!gen) return { ok: false, reason: 'NOT_FOUND' };
    if (!this.isUnlocked(gen)) return { ok: false, reason: 'LOCKED' };
    if (level < 1 || level >= (gen.upgrade?.maxLevel ?? 1)) return { ok: false, reason: 'MAX_LEVEL' };
    const pair = this.instances(gen.id).filter(c => !c.locked && this.catalog.get(c.item!.definitionId)?.level === level).slice(0,2);
    if (pair.length < 2) return { ok: false, reason: 'NOT_ENOUGH_GENERATORS' };
    const result = this.board.tryDrop(pair[0].index, pair[1].index);
    return result.ok ? { ok: true, level: level+1 } : { ok: false, reason: 'NOT_ENOUGH_GENERATORS' };
  }
  grantPurchased(id: string): { ok: true; inventory: number[] } | { ok: false; reason: 'NOT_FOUND' | 'LOCKED' | 'BOARD_FULL' } {
    const gen = this.get(id); if (!gen) return { ok: false, reason: 'NOT_FOUND' };
    if (!this.isUnlocked(gen)) return { ok: false, reason: 'LOCKED' };
    const index = this.emptyCell(); if (index === undefined) return { ok: false, reason: 'BOARD_FULL' };
    this.board.placeAt(index, generatorItemId(gen.id, 1)); return { ok: true, inventory: this.getInventory()[gen.id] };
  }
  grantLevelReward(level: number, rotation: readonly string[], gift?: GeneratorGift): string | null {
    if (gift) {
      const reward = this.addReward(gift.generatorId, gift.level, gift.count, 'level_reward');
      for (let i = 0; i < gift.count && !this.board.isFull(); i++) if (!this.claimReward(reward.id).ok) break;
      return gift.generatorId;
    }
    const eligible = rotation.map(id => this.get(id)).filter((g): g is GeneratorDefinition => !!g && this.isUnlocked(g)); if (!eligible.length) return null;
    const gen = eligible[Math.max(0, level-2) % eligible.length];
    this.claimReward(this.addReward(gen.id, 1, 1, 'level_reward').id); return gen.id;
  }
  restoreExhausted(key: string): { ok: true; kind: 'cooldown' | 'charges'; restoredUses: number } | { ok: false; reason: 'NOT_FOUND' | 'LOCKED' | 'NOT_NEEDED' | 'IN_PROGRESS' } {
    if (this.spawning) return { ok: false, reason: 'IN_PROGRESS' };
    const item = this.instance(key), gen = this.get(key), status = this.getStatus(key);
    if (!gen || !item || !status) return { ok: false, reason: 'NOT_FOUND' };
    if (!status.unlocked) return { ok: false, reason: 'LOCKED' };
    if (status.remainingUses !== 0) return { ok: false, reason: 'NOT_NEEDED' };
    item.generatorState = freshGeneratorState(this.catalog.get(item.definitionId)!.generator!, this.clock.now());
    return { ok: true, kind: gen.recharge ? 'charges' : 'cooldown', restoredUses: status.capacity };
  }
  rollOutput(gen: GeneratorDefinition, level = 1, boost = false): GeneratorOutput | null {
    const upgrade = gen.upgrade?.levels.find(v => v.level === level);
    return pickWeighted((boost ? upgrade?.boostOutputs : upgrade?.outputs) ?? gen.outputs, this.random);
  }
  spawn(key: string, boost?: boolean): SpawnResult {
    if (this.spawning) return { ok: false, reason: 'IN_PROGRESS' };
    this.spawning = true;
    try {
      this.ensureUnlockedCharges();
      const gen = this.get(key), item = this.instance(key), status = this.getStatus(key);
      if (!gen) return { ok: false, reason: 'UNKNOWN_GENERATOR' };
      if (!status?.unlocked || !item) return { ok: false, reason: 'LOCKED' };
      if (status.remainingCooldownMs > 0) return { ok: false, reason: 'GENERATOR_COOLDOWN' };
      if (status.charges === 0) return { ok: false, reason: 'NO_CHARGES' };
      const boosted = boost ?? status.boosted;
      if (boosted && !status.boostAvailable) return { ok: false, reason: 'BOOST_UNAVAILABLE' };
      const cost = gen.energyCost * (boosted ? gen.upgrade?.boostEnergyMultiplier ?? 2 : 1);
      if (!this.energy.canSpend(cost)) return { ok: false, reason: 'NOT_ENOUGH_ENERGY' };
      if (this.board.isFull()) return { ok: false, reason: 'BOARD_FULL' };
      const output = this.rollOutput(gen, status.level, boosted);
      if (!output || !this.catalog.has(output.itemId)) return { ok: false, reason: 'UNKNOWN_GENERATOR' };
      const rules = this.catalog.get(item.definitionId)!.generator!;
      const oldState = { ...(item.generatorState ?? freshGeneratorState(rules, this.clock.now())) };
      const nextState = consumeGeneratorUse(rules, oldState, this.clock.now());
      if (!nextState) return { ok: false, reason: 'GENERATOR_COOLDOWN' };
      item.generatorState = nextState;
      const spent = cost ? this.energy.spend(cost) : { ok: true as const };
      if (!spent.ok) { item.generatorState = oldState; return spent; }
      const spawned = this.board.spawn(output.itemId);
      if (!spawned.ok) { item.generatorState = oldState; if (cost) this.energy.add(cost); return spawned; }
      return { ok: true, uid: spawned.item.uid, cellIndex: spawned.cellIndex, itemDefinitionId: output.itemId };
    } finally { this.spawning = false; }
  }
}
