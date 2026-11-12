import { BlockInputEvents, Button, Graphics, Label, Node } from 'cc';
import type { GameContext } from '../../gameplay/GameContext';
import type { AdventureChapter, PlayResult, ReplayProgress } from '../../core/play/types';
import type { UiRoots } from './UiFactory';
import { applyArt, itemArt } from './CocosArt';
import { CocosTheme, createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect } from './CocosTheme';

function text(parent: Node, value: string, x: number, y: number, width = 590, height = 48, size = 24, color = '#825A54'): Label {
  const l = makeLabel(value, size, hexColor(color));
  parent.addChild(l.node); ensureTransform(l.node, width, height); l.node.setPosition(x, y, 0);
  l.enableWrapText = true; l.overflow = Label.Overflow.SHRINK; l.lineHeight = size + 8;
  return l;
}
function box(parent: Node, name: string, x: number, y: number, width: number, height: number, fill = '#FFF0E9'): Node {
  const n = createUiNode(name); parent.addChild(n); ensureTransform(n, width, height); n.setPosition(x, y, 0);
  paintRoundRect(n.addComponent(Graphics), width, height, 20, hexColor(fill), hexColor('#EDD9CD'), 1);
  return n;
}
function button(parent: Node, name: string, caption: string, x: number, y: number, width: number, height: number, tap: () => void, selected = false): Node {
  const n = box(parent, name, x, y, width, height, selected ? '#E993A3' : '#FFFDF6');
  text(n, caption, 0, 0, width - 14, height - 6, 23, selected ? '#FFFFFF' : '#825A54');
  n.addComponent(Button); n.on(Button.EventType.CLICK, tap); return n;
}
const failures: Record<Exclude<PlayResult, { ok: true }>['reason'], string> = {
  LOCKED: '先完成上一段约会并领取纪念，再达到本章等级即可开启', NOT_READY: '还没准备齐，先把所需物品放回棋盘吧',
  ALREADY_CLAIMED: '这份纪念已经珍藏，奖励不会重复领取',
  NOT_CLAIMED: '先领取这一章的纪念，才能免费重玩谜题',
  NO_DATE: '当前还没有可赴的小约会，解锁更多物品后再来看看吧',
  STALE_DATE: '这场小约会已经更新，请查看当前主题后再赴约',
  INVALID: '当前物品或操作不可用，请重新选择',
  WAREHOUSE_FULL: '仓库已满，先取回一件物品吧', BOARD_FULL: '棋盘已满，先留出一个空格再试',
  NO_SCISSORS: '剪刀用完了，完成今日约会可以获得', CANNOT_SPLIT: '初级物品无法拆分，请选择二级以上物品',
  WRONG_ANSWER: '还差一点，再看看线索吧。尝试不会扣除体力',
};

/** UI only: every state change goes through GameContext. */
export class CocosPlayPages {
  private readonly root: Node;
  private screen: 'hub' | 'chapter' | 'tools' | 'date' = 'hub';
  private chapterId = '';
  private toolsPage = 0;
  private hubPage = 0;
  private skipping = false;
  constructor(private readonly game: GameContext, private readonly roots: UiRoots,
    private readonly toast: (message: string) => void, private readonly changed: () => void,
    private readonly readMemory: (id: string) => void, private readonly clearToast: () => void, private readonly goMerge: () => void) {
    this.root = createUiNode('PlayOverlay'); roots.modalLayer.addChild(this.root);
    ensureTransform(this.root, roots.designWidth, roots.designHeight); this.root.addComponent(BlockInputEvents); this.root.active = false;
  }
  get isOpen(): boolean { return this.root.active; }
  openHub(): void {
    this.clearToast(); this.screen = 'hub'; this.root.active = true; this.skipping = false;
    this.hubPage = Math.min(this.hubPage, Math.max(0, Math.ceil(this.game.bundle.adventures.length / 3) - 1));
    this.render(); this.changed();
  }
  openTools(focus?: number): void {
    this.clearToast();
    this.screen = 'tools'; this.root.active = true;
    const index = this.game.board.getBoard().cells.filter((c) => c.item).findIndex((c) => c.index === focus);
    this.toolsPage = index < 0 ? 0 : Math.floor(index / 4); this.render(); this.changed();
  }
  openChapter(id: string): void {
    if (!this.game.play.isAvailable(id)) { this.toast(failures.LOCKED); return; }
    this.clearToast();
    this.chapterId = id; this.screen = 'chapter'; this.skipping = false; this.root.active = true; this.render(); this.changed();
  }
  openDate(): void {
    this.clearToast(); this.screen = 'date'; this.root.active = true; this.skipping = false; this.render(); this.changed();
  }
  private openReplay(id: string): void {
    const result = this.game.playAction('replay', id);
    if (!result.ok) { this.toast(failures[result.reason]); this.changed(); return; }
    this.clearToast();
    this.chapterId = id; this.screen = 'chapter'; this.skipping = false; this.root.active = true; this.render(); this.changed();
  }
  close(): void { this.clearToast(); this.root.active = false; this.skipping = false; this.changed(); }
  private result(result: PlayResult, success?: string): void {
    if (!result.ok) this.toast(failures[result.reason]); else if (success) this.toast(success);
    if (!result.ok) this.render(); this.changed();
  }
  private action(action: Parameters<GameContext['playAction']>[0], value: string, success?: string): void {
    this.result(this.game.playAction(action, value), success);
  }
  private puzzle(action: Parameters<GameContext['puzzleAction']>[1], value = ''): void {
    this.result(this.game.puzzleAction(this.chapterId, action, value));
  }
  render(): void {
    if (!this.isOpen) return;
    for (const child of [...this.root.children]) { child.removeFromParent(); child.destroy(); }
    paintRoundRect(this.root.getComponent(Graphics) ?? this.root.addComponent(Graphics), this.roots.designWidth, this.roots.designHeight, 0, hexColor('#362B2B', 174));
    const panel = box(this.root, 'PlayPanel', 0, 0, 690, 970, '#FFF8F1');
    const scale = Math.min(1, (this.roots.designHeight - 90) / 970, (this.roots.designWidth - 32) / 690);
    panel.setScale(scale, scale, 1);
    text(panel, this.screen === 'tools' ? '仓库与剪刀' : this.screen === 'hub' ? '今日约会'
      : this.screen === 'date' ? '小约会' : this.definition()?.title ?? '', -30, 429, 500, 55, 31);
    button(panel, 'PlayClose', '关闭', 278, 431, 90, 48, () => this.close());
    if (this.screen === 'hub') this.hub(panel);
    else if (this.screen === 'tools') this.tools(panel);
    else if (this.screen === 'date') this.smallDate(panel);
    else this.chapter(panel);
  }
  private definition(): AdventureChapter | undefined { return this.game.bundle.adventures.find((c) => c.id === this.chapterId); }
  private picture(parent: Node, memoryId: string, width: number, height: number, x: number, y: number): Node {
    const memory = this.game.bundle.memories.find((m) => m.id === memoryId)!;
    const n = createUiNode('AdventureIllustration'); parent.addChild(n); n.setPosition(x, y, 0);
    applyArt(n, { sheet: memory.art.split('#')[0], cropToFill: true, cropFocusY: memory.artFocusY ?? .2 }, width, height);
    return n;
  }
  private hub(panel: Node): void {
    text(panel, '准备心意 · 寻找线索 · 珍藏我们的故事', 0, 368, 620, 42, 22);
    const pages = Math.max(1, Math.ceil(this.game.bundle.adventures.length / 3));
    this.hubPage = Math.max(0, Math.min(this.hubPage, pages - 1));
    const chapters = this.game.bundle.adventures.slice(this.hubPage * 3, this.hubPage * 3 + 3);
    chapters.forEach((chapter, index) => {
      const p = this.game.play.progress(chapter.id), available = this.game.play.isAvailable(chapter.id);
      const card = box(panel, 'Adventure_' + chapter.id, 0, 232 - index * 208, 630, 188, available ? '#FFEEE7' : '#EDE8E1');
      this.picture(card, chapter.memoryId, 150, 150, -224, 0);
      text(card, chapter.title, 75, 54, 440, 44, 25);
      const caption = p.claimed ? '纪念已珍藏 · 可重玩谜题或查看回忆' : !available ? `Lv.${chapter.unlockLevel} · 完成前一段约会后开启`
        : p.outcome !== 'playing' ? '谜题已完成，领取纪念吧' : p.step < chapter.steps.length ? `剧情订单 ${p.step}/${chapter.steps.length} · 不会过期` : '心意已备齐，进入探索吧';
      text(card, caption, 75, 10, 440, 40, 19);
      if (p.claimed) {
        button(card, 'AdventureReplay_' + chapter.id, '重玩谜题', -50, -60, 210, 48,
          () => this.openReplay(chapter.id), true);
        button(card, 'AdventureMemory_' + chapter.id, '查看纪念', 175, -60, 210, 48, () => {
          this.root.active = false; this.readMemory(chapter.memoryId); this.changed();
        });
      } else {
        button(card, 'AdventureOpen_' + chapter.id, available ? '打开约会 ›' : '查看开启条件', 75, -60, 330, 48,
          () => this.openChapter(chapter.id), available);
      }
    });
    const date = this.game.play.smallDateOrder();
    const dateCard = box(panel, 'SmallDateEntry', 0, -344, 630, 92, '#FFF3E5');
    if (date) {
      text(dateCard, '小约会 · ' + date.template.title, -85, 21, 380, 34, 23, '#B05A64');
      text(dateCard, date.ready ? `已完成 ${date.completed} 次 · 心意已备齐，可以赴约`
        : `已完成 ${date.completed} 次 · 备好心意，就出发吧`, -85, -19, 400, 34, 18);
      button(dateCard, 'SmallDateOpen', '去赴约 ›', 238, 0, 132, 52, () => this.openDate(), true);
    } else {
      text(dateCard, '小约会 · 准备中', -85, 21, 380, 34, 23, '#B05A64');
      text(dateCard, '再解锁一些物品，就会有随时可玩的小约会。', -85, -19, 400, 34, 18);
      button(dateCard, 'SmallDateMerge', '回合成页', 238, 0, 132, 52, () => { this.root.active = false; this.goMerge(); this.changed(); });
    }
    if (pages > 1) {
      button(panel, 'HubPrev', '‹ 上一页', -215, -414, 140, 40, () => { this.hubPage = (this.hubPage - 1 + pages) % pages; this.render(); });
      text(panel, `${this.hubPage + 1} / ${pages}`, 0, -414, 120, 34, 20);
      button(panel, 'HubNext', '下一页 ›', 215, -414, 140, 40, () => { this.hubPage = (this.hubPage + 1) % pages; this.render(); });
    } else {
      text(panel, '全部章节已在此页', 0, -414, 300, 34, 19);
    }
    text(panel, '探索不消耗体力 · 免费提示 · 可跳过谜题\n已完成章节可免费重玩，练习完成不重复发奖', 0, -458, 620, 42, 18);
  }
  private smallDate(panel: Node): void {
    button(panel, 'SmallDateBack', '‹ 约会目录', -232, 368, 170, 42, () => this.openHub());
    const order = this.game.play.smallDateOrder();
    if (!order) {
      text(panel, '当前还没有可以赴的小约会。\n再解锁一些物品，就会在这里出现随时可玩的小约会。', 0, 120, 610, 140, 25);
      button(panel, 'SmallDateNoOrderMerge', '回合成页准备 ›', 0, -20, 380, 58, () => { this.root.active = false; this.goMerge(); this.changed(); }, true);
      return;
    }
    const memoryId = this.game.bundle.memories.some((memory) => memory.id === order.template.memoryId)
      ? order.template.memoryId : this.game.bundle.memories[0]?.id;
    if (memoryId) this.picture(panel, memoryId, 590, 250, 0, 170);
    text(panel, `主题 · ${order.template.title}`, 0, -6, 610, 46, 29);
    text(panel, order.template.description, 0, -64, 600, 66, 22);
    text(panel, `今日小约会  ·  已完成 ${order.completed} 次`, 0, -122, 610, 36, 21);
    text(panel, `金币 +${order.template.rewardCoins} · 爱心 +${order.template.rewardHearts} · 经验 +${order.template.rewardXp}`,
      0, -160, 610, 36, 22);
    const names = order.requirements.map((req) => this.game.bundle.catalog.get(req.itemId)?.displayName ?? req.itemId);
    const missing = order.requirements.filter((req) => !req.done)
      .map((req) => this.game.bundle.catalog.get(req.itemId)?.displayName ?? req.itemId);
    text(panel, order.requirements.map((req, index) => `${names[index]}  ${req.have}/${req.count}`).join('  +  '), 0, -204, 610, 52, 25);
    const caption = order.ready ? '交付小约会 ›' : missing.length ? `还缺：${missing.join('、')}` : '检查准备进度';
    button(panel, 'SmallDateDeliver', caption, 0, -290, 470, 62, () => {
      if (order.ready) this.action('small_date', order.token, '小约会完成，心意已收好 ♥');
      else this.toast(missing.length ? `还缺：${missing.join('、')}，先回合成页准备吧` : '还没准备齐，先回合成页准备吧');
    }, order.ready);
    button(panel, 'SmallDateToMerge', '回合成页准备', 0, -366, 340, 52, () => { this.root.active = false; this.goMerge(); this.changed(); });
    text(panel, '备好心意，就出发吧 · 完成后还有下一场约会', 0, -430, 620, 36, 20);
  }
  private tools(panel: Node): void {
    const state = this.game.play.state;
    text(panel, `收纳 ${state.warehouse.length}/${this.game.config.toolbox.warehouseSlots} · 剪刀 ${state.scissors} 把`, 0, 362, 620, 46, 24);
    text(panel, '收纳不消耗物品；取回棋盘后才能交付订单', 0, 321, 620, 38, 19);
    for (let i = 0; i < this.game.config.toolbox.warehouseSlots; i++) {
      const item = state.warehouse[i];
      const slot = button(panel, 'Warehouse_' + i, item ? '' : '空位', -210 + i % 3 * 210, 250 - Math.floor(i / 3) * 96, 194, 82,
        () => { if (item) this.action('withdraw', item.uid, '已取回棋盘'); else this.toast('在下方物品列表点击收纳，即可放进仓库'); });
      if (item) {
        const icon = createUiNode('StoredItem'); slot.addChild(icon); icon.setPosition(-60, 0, 0);
        const art = itemArt(item.definitionId); if (art) applyArt(icon, art, 60, 60);
        text(slot, this.game.bundle.catalog.get(item.definitionId)?.displayName ?? item.definitionId, 30, 14, 116, 36, 20);
        text(slot, '点击取回', 30, -20, 116, 28, 17);
      }
    }
    const occupied = this.game.board.getBoard().cells.filter((c) => c.item);
    const pages = Math.max(1, Math.ceil(occupied.length / 4)); this.toolsPage = Math.min(this.toolsPage, pages - 1);
    text(panel, '棋盘物品 · 选择收纳或拆分', 0, 78, 610, 40, 23);
    occupied.slice(this.toolsPage * 4, this.toolsPage * 4 + 4).forEach((cell, i) => {
      const row = box(panel, 'ToolItem_' + cell.index, 0, 17 - i * 64, 620, 56);
      const definition = this.game.bundle.catalog.get(cell.item!.definitionId);
      text(row, `格 ${cell.index + 1} · ${definition?.displayName ?? '物品'}`, -130, 0, 330, 42, 22);
      button(row, 'Store_' + cell.index, '收纳', 100, 0, 112, 44, () => this.action('store', String(cell.index), '已放入仓库'));
      button(row, 'Split_' + cell.index, '拆分', 231, 0, 112, 44, () => this.action('split', String(cell.index), '已拆成两个低一级物品'), true);
    });
    if (!occupied.length) text(panel, '棋盘还空着，先生成一些物品吧', 0, -65, 600, 70, 23);
    button(panel, 'ToolsPrev', '上一页', -190, -257, 148, 48, () => { this.toolsPage = (this.toolsPage - 1 + pages) % pages; this.render(); });
    text(panel, `${this.toolsPage + 1}/${pages}`, 0, -257, 130, 45, 23);
    button(panel, 'ToolsNext', '下一页', 190, -257, 148, 48, () => { this.toolsPage = (this.toolsPage + 1) % pages; this.render(); });
    text(panel, '剪刀将二级以上物品拆成两个低一级物品，\n每次消耗1把，需一格空位；完成约会还能获得。', 0, -335, 610, 88, 22);
    button(panel, 'ToolsToAdventure', '去今日约会获得剪刀 ›', 0, -425, 450, 54, () => this.openHub(), true);
  }
  private chapter(panel: Node): void {
    const chapter = this.definition(); if (!chapter) return;
    const replay = this.game.play.replayProgress(chapter.id);
    if (replay) { this.replayChapter(panel, chapter, replay); return; }
    const p = this.game.play.progress(chapter.id);
    button(panel, 'AdventureBack', '‹ 约会目录', -232, 368, 170, 42, () => this.openHub());
    text(panel, `准备 ${p.step}/${chapter.steps.length}  ·  ${p.claimed ? '已珍藏' : p.outcome === 'playing' ? '探索中' : '待领取'}`, 110, 368, 350, 42, 22);
    if (p.outcome !== 'playing') { this.completed(panel, chapter); return; }
    if (p.step < chapter.steps.length) {
      this.picture(panel, chapter.memoryId, 590, 285, 0, 170);
      text(panel, p.step > 0 ? chapter.steps[p.step - 1].note : chapter.intro, 0, -28, 590, 94, 23);
      const step = chapter.steps[p.step], progress = this.game.board.getOrderProgress(step);
      text(panel, step.title, 0, -122, 580, 54, 29);
      const needs = progress.requirements.map((r) => `${this.game.bundle.catalog.get(r.itemId)?.displayName ?? r.itemId}  ${r.have}/${r.count}`).join('  +  ');
      text(panel, needs, 0, -195, 580, 76, 27);
      const missing = progress.requirements.filter((r) => !r.done)
        .map((r) => this.game.bundle.catalog.get(r.itemId)?.displayName ?? r.itemId);
      button(panel, 'AdventureDeliver', progress.ready ? '交付心意 ›'
        : missing.length ? `还缺：${missing.join('、')}` : '检查准备进度', 0, -284, 470, 65,
      () => {
        if (progress.ready) this.action('deliver', chapter.id, '心意已交付，新的线索展开了');
        else this.toast(missing.length ? `还缺：${missing.join('、')}，先回合成页准备吧` : '还没准备齐，先回合成页准备吧');
      }, progress.ready);
      button(panel, 'AdventureToMerge', '回合成页准备', 0, -376, 340, 56, () => { this.root.active = false; this.goMerge(); this.changed(); });
      text(panel, '已收纳的物品需先取回棋盘 · 订单没有倒计时', 0, -440, 620, 35, 19); return;
    }
    this.puzzleBoard(panel, chapter, p.hints, false);
  }
  private replayChapter(panel: Node, chapter: AdventureChapter, replay: ReplayProgress): void {
    button(panel, 'AdventureBack', '‹ 约会目录', -232, 368, 170, 42, () => this.openHub());
    text(panel, '重玩练习 · 不消耗体力 · 不重复发奖', 105, 368, 390, 42, 21);
    if (replay.outcome === 'playing') {
      this.puzzleBoard(panel, chapter, replay.hints, true);
      return;
    }
    this.picture(panel, chapter.memoryId, 590, 330, 0, 155);
    text(panel, '练习完成，无重复奖励', 0, -105, 610, 65, 30, '#B05A64');
    text(panel, '这一章的纪念、已解锁回忆和一次性奖励都保持原样。', 0, -178, 610, 60, 23);
    text(panel, `提示使用 ${replay.hints}/${chapter.hints.length} · 完成方式：${replay.outcome === 'skipped' ? '跳过谜题' : '完成谜题'}`, 0, -238, 610, 44, 21);
    button(panel, 'ReplayAgain', '再练一次', -110, -330, 210, 58, () => this.action('replay_reset', chapter.id, '重新开始练习'), true);
    button(panel, 'ReplayMemory', '查看纪念', 130, -330, 210, 58, () => {
      this.root.active = false; this.readMemory(chapter.memoryId); this.changed();
    });
    button(panel, 'ReplayBack', '返回约会目录', 0, -410, 320, 52, () => this.openHub());
    text(panel, '退出练习会保留进度；下次点“重玩谜题”可继续。', 0, -460, 620, 32, 18);
  }
  private puzzleBoard(panel: Node, chapter: AdventureChapter, hints: number, replay: boolean): void {
    text(panel, chapter.instruction, 0, 294, 610, 90, 23);
    if (chapter.puzzle.kind === 'find') this.findPuzzle(panel, chapter);
    else if (chapter.puzzle.kind === 'sequence') this.sequencePuzzle(panel, chapter);
    else this.circuitPuzzle(panel, chapter);
    const hint = hints > 0 ? chapter.hints[hints - 1] : '需要帮助时可以免费查看提示，尝试错误不会扣体力。';
    text(panel, hint, 0, -283, 610, 90, 21);
    button(panel, 'PuzzleHint', `提示 ${hints}/${chapter.hints.length}`, -206, -365, 182, 54, () => this.action('hint', chapter.id));
    button(panel, 'PuzzleCheck', replay ? '检查练习' : '检查答案', 0, -365, 192, 54, () => this.action('solve', chapter.id), true);
    button(panel, 'PuzzleReset', '重置机关', 206, -365, 182, 54, () => this.puzzle('reset'));
    if (this.skipping) {
      button(panel, 'PuzzleSkipConfirm', replay ? '确认跳过练习' : '确认跳过并继续珍藏', -70, -436, 390, 52,
        () => { this.skipping = false; this.action('skip', chapter.id); });
      button(panel, 'PuzzleSkipCancel', '再想想', 234, -436, 140, 52, () => { this.skipping = false; this.render(); });
    } else button(panel, 'PuzzleSkip', replay ? '跳过这次练习 ›' : '想先看故事？跳过谜题 ›', 0, -436, 460, 50,
      () => { this.skipping = true; this.render(); });
  }
  private findPuzzle(panel: Node, chapter: AdventureChapter): void {
    if (chapter.puzzle.kind !== 'find') return;
    const p = this.game.play.puzzleProgress(chapter.id);
    const scene = box(panel, 'FindScene', 0, 137, 600, 210);
    this.picture(scene, chapter.memoryId, 590, 204, 0, 0);
    for (const spot of chapter.puzzle.hotspots) button(scene, 'Clue_' + spot.id, p.found.includes(spot.id) ? '✓' : '?', spot.x, spot.y * .65, 72, 72,
      () => this.puzzle('find', spot.id), p.found.includes(spot.id));
    const clues = chapter.puzzle.hotspots.filter((h) => p.found.includes(h.id)).map((h) => h.clue).join('\n');
    text(panel, clues || '点击画面里的三个标记，把找到的线索记下来。', 0, -20, 610, 94, 21);
    text(panel, `抽屉密码  ${p.code.padEnd(4, '＿')}`, 0, -94, 500, 44, 28);
    for (let i = 0; i < 10; i++) button(panel, 'PuzzleDigit_' + i, String(i), -224 + i % 5 * 112, -148 - Math.floor(i / 5) * 60, 96, 52, () => this.puzzle('digit', String(i)));
    button(panel, 'PuzzleErase', '退格', 269, -94, 76, 44, () => this.puzzle('erase'));
  }
  private sequencePuzzle(panel: Node, chapter: AdventureChapter): void {
    if (chapter.puzzle.kind !== 'sequence') return;
    const p = this.game.play.puzzleProgress(chapter.id);
    chapter.puzzle.tiles.forEach((tile, i) => {
      const card = button(panel, 'Letter_' + tile.id, '', i % 2 ? 156 : -156, i < 2 ? 144 : -13, 294, 140,
        () => this.puzzle('select', tile.id), p.selected.includes(tile.id));
      text(card, tile.label, 0, 31, 270, 44, 28, p.selected.includes(tile.id) ? '#FFFFFF' : '#825A54');
      text(card, tile.clue, 0, -30, 263, 65, 21, p.selected.includes(tile.id) ? '#FFFFFF' : '#825A54');
    });
    const tiles = chapter.puzzle.tiles;
    text(panel, p.selected.length ? p.selected.map((id) => tiles.find((t) => t.id === id)?.label).join(' → ') : '依次选择四封信', 0, -157, 610, 88, 25);
    text(panel, '点击已经选过的信，可从那里重新排列', 0, -220, 590, 40, 20);
  }
  private circuitPuzzle(panel: Node, chapter: AdventureChapter): void {
    const circuit = this.game.play.circuit(chapter.id); if (!circuit) return;
    text(panel, '入口 →                         → 爱心', 0, 222, 550, 36, 21);
    text(panel, '入 →', -263, 133, 74, 44, 24);
    text(panel, '→ ♥', 263, -147, 74, 44, 24);
    circuit.ports.forEach((ports, index) => {
      const lit = circuit.lit.includes(index);
      const tile = button(panel, 'Circuit_' + index, '', -150 + index % 3 * 150, 133 - Math.floor(index / 3) * 140, 130, 124,
        () => this.puzzle('rotate', String(index)), lit);
      const wire = createUiNode('CircuitWire'); tile.addChild(wire);
      const g = wire.addComponent(Graphics); g.lineWidth = 15; g.strokeColor = hexColor(lit ? '#FFE797' : '#9D8F86');
      for (const port of ports) { g.moveTo(0, 0); g.lineTo([0, 60, 0, -60][port], [57, 0, -57, 0][port]); g.stroke(); }
      g.fillColor = hexColor('#FFF9EF'); g.circle(0, 0, 10); g.fill();
    });
    const puzzle = chapter.puzzle;
    if (puzzle.kind !== 'circuit') return;
    const corner = (index: number): string => {
      const row = Math.floor(index / puzzle.columns), column = index % puzzle.columns;
      const vertical = row === 0 ? '上' : row === puzzle.rows - 1 ? '下' : '';
      const horizontal = column === 0 ? '左' : column === puzzle.columns - 1 ? '右' : '';
      return `${vertical}${horizontal}` || '入口';
    };
    text(panel, `${corner(puzzle.start)}连入 · ${corner(puzzle.end)}连出 · 点格子旋转`, 0, -219, 590, 40, 21);
  }
  private completed(panel: Node, chapter: AdventureChapter): void {
    const p = this.game.play.progress(chapter.id);
    this.picture(panel, chapter.memoryId, 590, 340, 0, 145);
    text(panel, p.claimed ? '这段回忆和纪念物，已经珍藏 ♥' : '心意已送达，这一页回忆为你展开 ♥', 0, -95, 610, 58, 27);
    const r = chapter.reward;
    text(panel, `金币 +${r.coins} · 爱心 +${r.hearts} · 体力 +${r.energy}（至上限）\n剪刀 +${r.scissors} · ${p.claimed ? '一次性奖励已领取' : '完成后可领取一次'}`, 0, -164, 610, 78, 22);
    text(panel, `家园纪念：${chapter.souvenir.title}`, 0, -230, 600, 44, 23);
    if (p.claimed) {
      text(panel, '已完成的章节可以免费重玩谜题，练习进度独立保存。', 0, -282, 610, 40, 21);
      button(panel, 'AdventureReplay', '重玩谜题', -120, -352, 220, 62, () => this.openReplay(chapter.id), true);
      button(panel, 'AdventureMemory', '查看纪念', 120, -352, 220, 62, () => {
        this.root.active = false; this.readMemory(chapter.memoryId); this.changed();
      });
      text(panel, '重玩不消耗体力，也不会重复发放金币、爱心、体力或剪刀。', 0, -425, 620, 36, 18);
    } else {
      button(panel, 'AdventureClaim', '领取回忆与纪念物', 0, -352, 480, 66,
        () => this.action('claim', chapter.id, '回忆与纪念物已珍藏，奖励已领取 ♥'), true);
      text(panel, '纪念物会出现在对应房间，点击可再看这段故事', 0, -431, 630, 54, 20);
    }
  }
}
