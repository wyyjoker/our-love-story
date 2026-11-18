import { describe, expect, it } from 'vitest';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { generatorItemDefinitions, generatorItemId, freshGeneratorState, effectiveGeneratorState,
  consumeGeneratorUse, generatorAvailability, mergeGeneratorStates } from '../assets/scripts/core/generator/generatorItems';
import { createItemCatalog } from '../assets/scripts/core/item/catalog';
import { createEmptyBoard, cloneBoard } from '../assets/scripts/core/board/board';
import { applyDrop, resolveDrop } from '../assets/scripts/core/board/rules';
import { MergeEngine } from '../assets/scripts/core/merge/mergeEngine';
import type { GeneratorItemRules, GeneratorItemState, ItemInstance } from '../assets/scripts/core/types';
import { BoardService } from '../assets/scripts/gameplay/BoardService';
import { GameEventBus } from '../assets/scripts/events/GameEventBus';
import { SequentialIdService } from '../assets/scripts/infrastructure/IdService';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';

const bundle = loadConfigBundle();
const definitions = generatorItemDefinitions(bundle.generators);
const catalog = createItemCatalog([...bundle.items.filter(item => !item.generator), ...definitions]);
const rules = (id: string, level = 1): GeneratorItemRules => catalog.get(generatorItemId(id, level))!.generator!;
const machine = (uid: string, id = 'coffee_machine', level = 1, now = 10_000): ItemInstance & { generatorState: GeneratorItemState } => ({ uid,
  definitionId: generatorItemId(id, level), generatorState: freshGeneratorState(rules(id, level), now) });

describe('physical producer item rules', () => {
  it('compiles eight distinct tiers from each configured producer without a second item inventory', () => {
    for (const generator of bundle.generators) {
      for (let level = 1; level <= 8; level += 1) {
        const definition = catalog.get(generatorItemId(generator.id, level))!;
        expect(definition.generator?.id).toBe(generator.id); expect(definition.level).toBe(level);
        expect(definition.wildcardEligible).toBe(false);
        expect(definition.nextItemId).toBe(level === 8 ? undefined : generatorItemId(generator.id, level + 1));
      }
    }
  });

  it('starts ordinary machines with 60 uses and orange trees with ten', () => {
    expect(machine('a').generatorState?.remainingUses).toBe(60);
    expect(machine('b', 'orange_tree').generatorState?.remainingUses).toBe(10);
    expect(rules('orange_tree').recoveryIntervalMs).toBe(60_000);
    expect(rules('coffee_machine', 2).cooldownMs).toBe(Math.round(rules('coffee_machine').cooldownMs * .8));
  });

  it('exhausts only the clicked machine and refills it after its full cooldown', () => {
    const rule = rules('coffee_machine'), first = machine('a'), second = machine('b');
    for (let index = 0; index < 60; index += 1) first.generatorState = consumeGeneratorUse(rule, first.generatorState!, 10_000)!;
    expect(first.generatorState.remainingUses).toBe(0); expect(second.generatorState!.remainingUses).toBe(60);
    expect(consumeGeneratorUse(rule, first.generatorState, 10_000)).toBeNull();
    expect(generatorAvailability(rule, first.generatorState, 10_000).remainingCooldownMs).toBe(rule.cooldownMs);
    expect(effectiveGeneratorState(rule, first.generatorState, 10_000 + rule.cooldownMs - 1).remainingUses).toBe(0);
    expect(effectiveGeneratorState(rule, first.generatorState, 10_000 + rule.cooldownMs).remainingUses).toBe(60);
  });

  it('recovers a tree one charge per minute and does not bank time while full', () => {
    const rule = rules('orange_tree');
    const projected = effectiveGeneratorState(rule, freshGeneratorState(rule, 10_000), 610_000);
    const used = consumeGeneratorUse(rule, projected, 610_000)!;
    expect(used.remainingUses).toBe(9); expect(used.recoveryAt).toBe(610_000);
    expect(effectiveGeneratorState(rule, used, 669_999).remainingUses).toBe(9);
    expect(effectiveGeneratorState(rule, used, 670_000).remainingUses).toBe(10);
    const empty = { ...used, remainingUses: 0 };
    expect(effectiveGeneratorState(rule, empty, 790_000).remainingUses).toBe(3);
  });

  it('does not mutate projections and never grants uses when time moves backwards', () => {
    const rule = rules('orange_tree'), state = { ...freshGeneratorState(rule, 100_000), remainingUses: 2 };
    const snapshot = { ...state };
    expect(effectiveGeneratorState(rule, state, 50_000)).toEqual(state);
    expect(generatorAvailability(rule, state, 50_000).nextRecoveryMs).toBe(110_000);
    expect(state).toEqual(snapshot);
  });

  it('merges two partially used budgets proportionally instead of refilling to 60', () => {
    const first = { ...machine('a').generatorState!, remainingUses: 55, boosted: true };
    const second = { ...machine('b').generatorState!, remainingUses: 15 };
    const merged = mergeGeneratorStates(rules('coffee_machine'), rules('coffee_machine', 2), first, second, 10_000);
    expect(merged).toMatchObject({ remainingUses: 35, boosted: false, cooldownUntil: null });
    expect(first.remainingUses).toBe(55); expect(second.remainingUses).toBe(15);
  });

  it('keeps the slower exhausted cooldown fraction while applying the 20 percent tier improvement', () => {
    const old = rules('coffee_machine'), next = rules('coffee_machine', 2), now = 100_000;
    const a = { ...freshGeneratorState(old, 0), remainingUses: 0, cooldownUntil: now + old.cooldownMs / 2 };
    const b = { ...a, cooldownUntil: now + old.cooldownMs / 4 };
    const merged = mergeGeneratorStates(old, next, a, b, now);
    expect(merged.remainingUses).toBe(0); expect(merged.cooldownUntil).toBe(now + next.cooldownMs / 2);
  });
  it('uses the configured conservative merge ratio and never exceeds the average budget',()=>{
    const old=rules('coffee_machine'),next={...rules('coffee_machine',2),mergeRemainingRatio:.25},now=100_000;
    const a=freshGeneratorState(old,now),b=freshGeneratorState(old,now);
    expect(mergeGeneratorStates(old,next,a,b,now).remainingUses).toBe(30);
    expect(mergeGeneratorStates(old,{...next,mergeRemainingRatio:1},a,b,now).remainingUses).toBe(60);
    expect(bundle.generators.every(generator=>generator.upgrade?.mergeRemainingRatio===.5)).toBe(true);
  });

  it('keeps the lesser recovery fraction and the averaged remaining tree charges', () => {
    const old = rules('orange_tree'), next = rules('orange_tree', 2), now = 100_000;
    const a = { ...freshGeneratorState(old, now - 30_000), remainingUses: 8 };
    const b = { ...freshGeneratorState(old, now - 15_000), remainingUses: 2 };
    const merged = mergeGeneratorStates(old, next, a, b, now);
    expect(merged.remainingUses).toBe(5);
    expect(generatorAvailability(next, merged, now).nextRecoveryMs).toBe(next.recoveryIntervalMs * .75);
  });

  it('moves and swaps a machine in the same board without changing its UID or state', () => {
    const board = createEmptyBoard(9, 7); const first = machine('a'); first.generatorState!.remainingUses = 7;
    board.cells[0].item = first; board.cells[1].item = { uid: 'bean', definitionId: 'coffee_01' };
    const moved = applyDrop(board, catalog, 0, 62, 'unused', 100_000);
    expect(moved.ok).toBe(true); if (!moved.ok) return;
    expect(moved.board.cells[62].item).toEqual(first);
    const swapped = applyDrop(moved.board, catalog, 62, 1, 'unused2', 110_000);
    expect(swapped.ok).toBe(true); if (!swapped.ok) return;
    expect(swapped.board.cells[1].item).toEqual(first); expect(swapped.board.cells[62].item?.uid).toBe('bean');
    expect(board.cells[0].item).toEqual(first);
  });

  it('only merges matching machines and never accepts a wildcard or scissors on a producer', () => {
    const board = createEmptyBoard(9, 7);
    board.cells[0].item = machine('a'); board.cells[1].item = machine('b');
    expect(resolveDrop(board, catalog, 0, 1).kind).toBe('MERGE');
    board.cells[1].item = machine('c', 'flower_basket'); expect(resolveDrop(board, catalog, 0, 1).kind).toBe('SWAP');
    board.cells[1].item = machine('d', 'coffee_machine', 2); expect(resolveDrop(board, catalog, 0, 1).kind).toBe('SWAP');
    board.cells[1].item = { uid: 'wild', definitionId: 'wildcard' }; expect(resolveDrop(board, catalog, 1, 0).kind).toBe('SWAP');
    board.cells[1].item = { uid: 'shears', definitionId: 'scissors_05' }; expect(resolveDrop(board, catalog, 1, 0).kind).toBe('CANCEL');
    const max = new MergeEngine(catalog, 10_000).merge(machine('x', 'coffee_machine', 8), machine('y', 'coffee_machine', 8), 'z');
    expect(max).toEqual({ ok: false, reason: 'MAX_LEVEL' });
  });

  it('preserves nested machine states across board clones and failed locked drops', () => {
    const board = createEmptyBoard(9, 7); board.cells[0].item = machine('a'); board.cells[1].locked = true;
    const snapshot = cloneBoard(board); snapshot.cells[0].item!.generatorState!.remainingUses = 1;
    expect(board.cells[0].item!.generatorState!.remainingUses).toBe(60);
    expect(applyDrop(board, catalog, 0, 1, 'no', 10_000)).toEqual({ ok: false, reason: 'INVALID' });
    expect(board.cells[0].item!.generatorState!.remainingUses).toBe(60);
  });

  it('uses the injected gameplay clock when two physical producers merge', () => {
    const now = 100_000, clock = new FakeClockService(now), board = createEmptyBoard(1, 3);
    board.cells[0].item = machine('a', 'coffee_machine', 1, 0);
    board.cells[1].item = machine('b', 'coffee_machine', 1, 0);
    const duration = rules('coffee_machine').cooldownMs;
    for (const cell of board.cells.slice(0, 2)) cell.item!.generatorState = { ...cell.item!.generatorState!, remainingUses: 0, cooldownUntil: now + duration / 2 };
    const service = new BoardService(catalog, new SequentialIdService('physical'), new GameEventBus(), 1, 3, board, clock);
    expect(service.tryDrop(0, 1)).toMatchObject({ ok: true, kind: 'MERGE', resultDefinitionId: generatorItemId('coffee_machine', 2) });
    expect(service.getBoard().cells[1].item?.generatorState?.cooldownUntil).toBe(now + rules('coffee_machine', 2).cooldownMs / 2);
    expect(service.getBoard().cells[0].item).toBeUndefined();
  });
});
