import { BlockInputEvents, Button, Graphics, Label, Node, tween, UIOpacity, Vec3 } from 'cc';
import type { GameContext } from '../../gameplay/GameContext';
import type { AdventureChapter, PlayResult, ReplayProgress } from '../../core/play/types';
import type { UiRoots } from './UiFactory';
import { applyArt, itemArt } from './CocosArt';
import { CocosTheme, createUiNode, ensureOpacity, ensureTransform, hexColor, makeLabel, paintRoundRect } from './CocosTheme';

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
  LOCKED: '达到本章要求的等级即可开启', NOT_READY: '还没准备齐，先把所需物品放回棋盘吧',
  ALREADY_CLAIMED: '这份纪念已经珍藏，奖励不会重复领取',
  NOT_CLAIMED: '先领取这一章的纪念，才能免费重玩谜题',
  NO_DATE: '当前还没有可赴的小约会，解锁更多物品后再来看看吧',
  STALE_DATE: '这场小约会已经更新，请查看当前主题后再赴约',
  INVALID: '当前物品或操作不可用，请重新选择',
  WAREHOUSE_FULL: '背包已满，先取回一件物品吧', BOARD_FULL: '棋盘已满，先留出一个空格再试',
  NO_SCISSORS: '待领取剪刀已用完，探索或七日签到可补充', CANNOT_SPLIT: '初级物品无法拆分，请选择二级以上物品',
  WRONG_ANSWER: '还差一点，再看看线索吧。尝试不会扣除体力',
};

/** UI only: every state change goes through GameContext. */
export class CocosPlayPages {
  private readonly root: Node;
  private screen: 'hub' | 'chapter' | 'tools' | 'date' = 'hub';
  private chapterId = '';
  private hubPage = 0;
  readonly hubPageSize = 2;
  private skipping = false;
  constructor(private readonly game: GameContext, private readonly roots: UiRoots,
    private readonly toast: (message: string) => void, private readonly changed: () => void,
    private readonly readMemory: (id: string) => void, private readonly clearToast: () => void, private readonly goMerge: () => void,
    private readonly onPuzzleSuccess: () => void, private readonly onDateDelivered: (coins: number, xp: number, hearts: number) => void,
    private readonly goHome: () => void, private readonly openWeddingEnding: () => boolean) {
    this.root = createUiNode('PlayOverlay'); roots.modalLayer.addChild(this.root);
    ensureTransform(this.root, roots.designWidth, roots.designHeight); this.root.addComponent(BlockInputEvents); this.root.active = false;
  }
  get isOpen(): boolean { return this.root.active; }
  openHub(): void {
    this.clearToast(); this.screen = 'hub'; this.root.active = true; this.skipping = false;
    const journey = this.game.play.journeyProgress();
    const nextIndex = journey.nextChapter
      ? this.game.bundle.adventures.findIndex((chapter) => chapter.id === journey.nextChapter?.id) : 0;
    this.hubPage = Math.max(0, Math.floor(nextIndex / this.hubPageSize));
    this.render(); this.changed();
  }
  openTools(_focus?: number): void {
    this.clearToast();
    this.screen = 'tools'; this.root.active = true;
    this.render(); this.changed();
  }
  openChapter(id: string): void {
    if (!this.game.play.isAvailable(id)) { this.toast(`开启条件：${this.chapterLockText(id)}`); return; }
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
    const dateOrder = action === 'small_date' ? this.game.play.smallDateOrder() : undefined;
    const puzzleWasPlaying = action === 'solve' ? this.game.play.puzzleProgress(value).outcome === 'playing' : false;
    const result = this.game.playAction(action, value);
    this.result(result, success);
    if (result.ok && action === 'small_date' && dateOrder) {
      this.onDateDelivered(dateOrder.template.rewardCoins, dateOrder.template.rewardXp, dateOrder.template.rewardHearts);
    }
    if (result.ok && action === 'claim' && this.isFinalChapter(value)) this.showWeddingEnding();
    if (result.ok && action === 'solve' && puzzleWasPlaying && this.game.play.puzzleProgress(value).outcome === 'solved') {
      this.onPuzzleSuccess();
      this.showPuzzleSuccess();
    }
  }
  private showPuzzleSuccess(): void {
    if (!this.isOpen) return;
    const burst = box(this.root, 'PuzzleSuccessBurst', 0, 185, 440, 92, '#F6D9B4');
    text(burst, '线索拼好了！  ♥', 0, 0, 420, 78, 32, '#805A50');
    const opacity = ensureOpacity(burst);
    opacity.opacity = 0;
    burst.setScale(0.76, 0.76, 1);
    tween(opacity).to(0.12, { opacity: 255 }).delay(0.42).to(0.18, { opacity: 0 }).call(() => burst.destroy()).start();
    tween(burst).to(0.16, { scale: new Vec3(1.06, 1.06, 1) }).to(0.18, { scale: new Vec3(1, 1, 1) }).start();
  }
  private puzzle(action: Parameters<GameContext['puzzleAction']>[1], value = ''): void {
    this.result(this.game.puzzleAction(this.chapterId, action, value));
  }
  render(): void {
    if (!this.isOpen) return;
    for (const child of [...this.root.children]) { child.removeFromParent(); child.destroy(); }
    paintRoundRect(this.root.getComponent(Graphics) ?? this.root.addComponent(Graphics), this.roots.designWidth, this.roots.designHeight, 0, hexColor('#362B2B', 174));
    if (this.screen === 'tools') { this.renderBackpack(); return; }
    const panel = box(this.root, 'PlayPanel', 0, 0, 690, 970, '#FFF8F1');
    const scale = Math.min(1, (this.roots.designHeight - 90) / 970, (this.roots.designWidth - 32) / 690);
    panel.setScale(scale, scale, 1);
    text(panel, this.screen === 'hub' ? '我们的旅程'
      : this.screen === 'date' ? '小约会' : this.definition()?.title ?? '', -30, 429, 500, 55, 31);
    button(panel, 'PlayClose', '关闭', 272, 431, 90, 48, () => this.close());
    if (this.screen === 'hub') this.hub(panel);
    else if (this.screen === 'date') this.smallDate(panel);
    else this.chapter(panel);
  }
  private definition(): AdventureChapter | undefined { return this.game.bundle.adventures.find((c) => c.id === this.chapterId); }
  private isFinalChapter(id: string): boolean {
    return this.game.bundle.adventures[this.game.bundle.adventures.length - 1]?.id === id;
  }
  private showWeddingEnding(): void {
    if (this.openWeddingEnding()) this.close();
    else { this.close(); this.goHome(); this.toast('先珍藏婚礼回忆，再来读这封信吧'); }
  }
  private chapterLockText(id: string, separator = '；'): string {
    const availability = this.game.play.chapterAvailability(id);
    if (!availability) return '章节配置暂不可用';
    const reasons: string[] = [];
    if (availability.currentLevel < availability.requiredLevel) {
      reasons.push(`达到 Lv.${availability.requiredLevel}（当前 Lv.${availability.currentLevel}）`);
    }
    return reasons.length ? reasons.join(separator) : '现在可以开启';
  }
  private picture(parent: Node, memoryId: string, width: number, height: number, x: number, y: number): Node {
    const memory = this.game.bundle.memories.find((m) => m.id === memoryId)!;
    const n = createUiNode('AdventureIllustration'); parent.addChild(n); n.setPosition(x, y, 0);
    applyArt(n, { sheet: memory.art.split('#')[0], cropToFill: true, cropFocusY: memory.artFocusY ?? .2 }, width, height);
    return n;
  }
  private hub(panel: Node): void {
    const journey = this.game.play.journeyProgress();
    const next = journey.nextChapter;
    const available = journey.availability?.available ?? false;
    const journeyText = next
      ? `旅程 ${journey.completed}/${journey.total}\n推荐：${available ? next.title : '未解锁章节'}`
      : `旅程 ${journey.completed}/${journey.total}\n六章回忆已珍藏`;
    text(panel, journeyText, -82, 350, 450, 70, 24, '#A85D65');
    button(panel, 'JourneyNextStep', available ? '继续 ›' : next ? '回合成 ›' : '婚礼来信 ›', 244, 344, 150, 104, () => {
      if (!next) { this.showWeddingEnding(); return; }
      if (available) this.openChapter(next.id);
      else { this.root.active = false; this.goMerge(); this.changed(); }
    }, available);
    box(panel, 'JourneyProgressTrack', 0, 281, 620, 12, '#EBDAD2');
    if (journey.completed > 0) {
      const fillWidth = 620 * journey.completed / Math.max(1, journey.total);
      box(panel, 'JourneyProgressFill', -310 + fillWidth / 2, 281, fillWidth, 12, '#E993A3');
    }
    const pages = Math.max(1, Math.ceil(this.game.bundle.adventures.length / this.hubPageSize));
    this.hubPage = Math.max(0, Math.min(this.hubPage, pages - 1));
    const firstChapter = this.hubPage * this.hubPageSize;
    const chapters = this.game.bundle.adventures.slice(firstChapter, firstChapter + this.hubPageSize);
    chapters.forEach((chapter, index) => {
      const p = this.game.play.progress(chapter.id);
      const chapterAvailability = this.game.play.chapterAvailability(chapter.id);
      const chapterAvailable = chapterAvailability?.available ?? false;
      const recommended = journey.nextChapter?.id === chapter.id;
      const fill = chapterAvailable ? recommended ? '#FFE3DA' : '#FFEEE7' : '#EDE8E1';
      const card = box(panel, 'Adventure_' + chapter.id, 0, 143 - index * 258, 630, 244, fill);
      if (chapterAvailable || p.claimed) this.picture(card, chapter.memoryId, 130, 130, -235, 47);
      else text(card, '🔒', -235, 47, 130, 130, 30);
      text(card, chapterAvailable || p.claimed ? chapter.title : '未解锁章节', 75, 87, 440, 44, 25);
      const caption = p.claimed ? '已完成 · 纪念已珍藏\n可重玩谜题或查看回忆'
        : !chapterAvailable ? this.chapterLockText(chapter.id, '\n')
        : p.outcome !== 'playing' ? '谜题已完成\n领取纪念，继续旅程吧'
        : `Lv${chapter.unlockLevel} 解锁\n可直接探索，寻找线索吧`;
      text(card, caption, 75, 28, 440, 60, 22);
      if (p.claimed) {
        button(card, 'AdventureReplay_' + chapter.id, '重玩谜题', -50, -66, 210, 104,
          () => this.openReplay(chapter.id), true);
        button(card, 'AdventureMemory_' + chapter.id, '查看纪念', 175, -66, 210, 104, () => {
          this.root.active = false; this.readMemory(chapter.memoryId); this.changed();
        });
      } else {
        button(card, 'AdventureOpen_' + chapter.id, chapterAvailable ? recommended ? '继续这段约会 ›' : '打开约会 ›' : '查看条件', 75, -66, 330, 104,
          () => chapterAvailable ? this.openChapter(chapter.id) : this.toast(`开启条件：${this.chapterLockText(chapter.id)}`), recommended);
      }
    });
    const date = this.game.play.smallDateOrder();
    const dateCard = box(panel, 'SmallDateEntry', 0, -291, 630, 104, '#FFF3E5');
    if (date) {
      text(dateCard, '小约会 · ' + date.template.title, -85, 23, 380, 34, 23, '#B05A64');
      text(dateCard, `已完成 ${date.completed} 次 · ${date.ready ? '心意已备齐' : '备好心意再出发'}`, -85, -21, 400, 34, 22);
      button(dateCard, 'SmallDateOpen', '去赴约 ›', 238, 0, 132, 104, () => this.openDate(), true);
    } else {
      text(dateCard, '小约会 · 准备中', -85, 23, 380, 34, 23, '#B05A64');
      text(dateCard, '解锁更多物品，开启小约会', -85, -21, 400, 34, 22);
      button(dateCard, 'SmallDateMerge', '回合成页', 238, 0, 132, 104, () => { this.root.active = false; this.goMerge(); this.changed(); });
    }
    if (pages > 1) {
      button(panel, 'HubPrev', '‹ 上一页', -215, -399, 180, 104, () => { this.hubPage = (this.hubPage - 1 + pages) % pages; this.render(); });
      text(panel, `${this.hubPage + 1} / ${pages}`, 0, -399, 120, 34, 24);
      button(panel, 'HubNext', '下一页 ›', 215, -399, 180, 104, () => { this.hubPage = (this.hubPage + 1) % pages; this.render(); });
    } else {
      text(panel, '全部章节已在此页', 0, -399, 300, 34, 22);
    }
    text(panel, '免费提示 · 可跳过谜题 · 免费重玩不重复发奖', 0, -469, 620, 32, 22);
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
    if (memoryId && this.game.life.state.unlockedMemoryIds.includes(memoryId)) this.picture(panel, memoryId, 590, 250, 0, 170);
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
  private renderBackpack(): void {
    const state = this.game.play.state, capacity = this.game.config.toolbox.warehouseSlots;
    const panel = box(this.root, 'PlayPanel', 0, 0, 690, 660, '#FFF8F1');
    const scale = Math.min(1, (this.roots.designHeight - 80) / 660, (this.roots.designWidth - 28) / 690);
    panel.setScale(scale, scale, 1);
    panel.setPosition(0, -this.roots.designHeight / 2 + 330 * scale + 18, 0);
    const handle = box(panel, 'BackpackHandle', 0, 313, 72, 6, '#E4CCC1');
    handle.pauseSystemEvents(true);
    const bag = createUiNode('BackpackHeaderArt'); panel.addChild(bag); bag.setPosition(-277, 263, 0);
    applyArt(bag, { sheet:'scissors_backpack_sheet', index:5, columns:3, rows:2, preserveAspect:true }, 62, 66);
    text(panel, '随身背包', -100, 269, 300, 48, 32);
    button(panel, 'PlayClose', '关闭', 270, 271, 104, 64, () => this.close());
    text(panel, `收纳 ${state.warehouse.length}/${capacity}`, -166, 215, 260, 34, 24, '#A66567');
    text(panel, '点物品取回 · 从棋盘拖入背包收纳', 0, 181, 620, 28, 20, '#A48071');
    for (let i = 0; i < capacity; i++) {
      const item = state.warehouse[i];
      const slot = button(panel, 'Warehouse_' + i, item ? '' : '空位', -210 + i % 3 * 210, 86 - Math.floor(i / 3) * 160, 198, 146,
        () => { if (item) this.action('withdraw', item.uid); else this.toast('将棋盘物品拖到背包图标即可收纳'); });
      if (!item) continue;
      const definition = this.game.bundle.catalog.get(item.definitionId);
      const icon = createUiNode('StoredItem'); slot.addChild(icon); icon.setPosition(-46, 7, 0);
      const art = itemArt(item.definitionId); if (art) applyArt(icon, { ...art, preserveAspect:true }, 90, 92);
      text(slot, definition?.displayName ?? '物品', 48, 31, 94, 52, 22);
      text(slot, definition?.maxUses ? `${item.remainingUses ?? definition.maxUses}次可用` : `Lv${definition?.level ?? '—'}`, 48, -9, 92, 28, 20, '#A8786D');
      text(slot, '点击取回', 48, -43, 94, 28, 20, '#B45E68');
    }
    const stock = box(panel, 'ScissorsStockCard', 0, -217, 620, 120, '#F6EEE4');
    const scissors = createUiNode('ScissorsStockArt'); stock.addChild(scissors); scissors.setPosition(-253, 0, 0);
    const scissorsArt = itemArt('scissors_01'); if (scissorsArt) applyArt(scissors, { ...scissorsArt, preserveAspect:true }, 74, 74);
    text(stock, `待取剪刀 ×${state.scissors}`, -83, 20, 250, 38, 25);
    text(stock, '取出后拖到2级以上物品', -83, -23, 260, 32, 19, '#A48071');
    button(stock, 'TakeScissors', state.scissors ? '取出1级剪刀' : '库存已取完', 178, 0, 214, 66, () => this.action('take_scissors', ''), state.scissors > 0).getComponent(Button)!.interactable = state.scissors > 0;
    text(panel, '探索与七日签到可补充剪刀 · 用完即消失', 0, -306, 620, 28, 20, '#A48071');
  }
  private chapter(panel: Node): void {
    const chapter = this.definition(); if (!chapter) return;
    const replay = this.game.play.replayProgress(chapter.id);
    if (replay) { this.replayChapter(panel, chapter, replay); return; }
    const p = this.game.play.progress(chapter.id);
    button(panel, 'AdventureBack', '‹ 约会目录', -232, 368, 170, 42, () => this.openHub());
    text(panel, `Lv${chapter.unlockLevel} 解锁  ·  ${p.claimed ? '已珍藏' : p.outcome === 'playing' ? '探索中' : '待领取'}`, 110, 368, 350, 42, 22);
    if (p.outcome !== 'playing') { this.completed(panel, chapter); return; }
    this.puzzleBoard(panel, chapter, p.hints, false);
  }
  private replayChapter(panel: Node, chapter: AdventureChapter, replay: ReplayProgress): void {
    const definition = this.game.play.puzzleDefinition(chapter.id);
    if (!definition) return;
    const summary = this.game.play.replaySummary(chapter.id);
    const best = summary.bestSolvedHints === null ? '暂无' : `${summary.bestSolvedHints}次`;
    button(panel, 'AdventureBack', '‹ 约会目录', -232, 368, 170, 42, () => this.openHub());
    text(panel, `练习第 ${summary.started} 局${summary.legacyHistoryIncomplete ? ' · 旧记录不完整' : ' · 免费重玩'}`, 105, 368, 390, 42, 22);
    if (replay.outcome === 'playing') {
      text(panel, `完成 ${summary.solved} · 跳过 ${summary.skipped} · 已结算提示 ${summary.totalHints} · 最佳 ${best}`, 0, 326, 620, 28, 20);
      this.puzzleBoard(panel, chapter, replay.hints, true);
      return;
    }
    this.picture(panel, chapter.memoryId, 590, 230, 0, 192);
    text(panel, replay.outcome === 'skipped' ? '练习已跳过，无重复奖励' : '练习完成，无重复奖励', 0, 30, 610, 50, 28, '#B05A64');
    text(panel, '纪念、回忆与一次性奖励保持原样', 0, -30, 610, 44, 22);
    text(panel, `本局提示 ${replay.hints}/${definition.hints.length} · ${replay.outcome === 'skipped' ? '跳过谜题' : '完成谜题'}`, 0, -80, 610, 44, 22);
    text(panel, `练习 ${summary.started} 局 · 完成 ${summary.solved} · 跳过 ${summary.skipped}\n已结算提示 ${summary.totalHints} · 最佳提示：${best}`, 0, -146, 610, 64, 24);
    text(panel, summary.legacyHistoryIncomplete ? '旧版历史记录不完整，以上为已记录成绩' : '练习进度与成绩独立保存 · 不消耗体力', 0, -208, 620, 40, 22);
    button(panel, 'ReplayAgain', '再练一次', -137, -292, 250, 104, () => this.action('replay_reset', chapter.id, '重新开始练习'), true);
    button(panel, 'ReplayMemory', '查看纪念', 137, -292, 250, 104, () => {
      this.root.active = false; this.readMemory(chapter.memoryId); this.changed();
    });
    button(panel, 'ReplayBack', '返回约会目录', 0, -410, 500, 104, () => this.openHub());
  }
  private puzzleBoard(panel: Node, chapter: AdventureChapter, hints: number, replay: boolean): void {
    const definition = this.game.play.puzzleDefinition(chapter.id);
    if (!definition) return;
    text(panel, definition.instruction, 0, replay ? 276 : 294, 610, replay ? 60 : 90, replay ? 22 : 23);
    if (definition.puzzle.kind === 'find') this.findPuzzle(panel, chapter);
    else if (definition.puzzle.kind === 'sequence') this.sequencePuzzle(panel, chapter);
    else this.circuitPuzzle(panel, chapter);
    const hint = hints > 0 ? definition.hints[hints - 1] : '需要帮助时可以免费查看提示，尝试错误不会扣体力。';
    text(panel, hint, 0, -283, 610, 90, 21);
    button(panel, 'PuzzleHint', `提示 ${hints}/${definition.hints.length}`, -206, -365, 182, 54, () => this.action('hint', chapter.id));
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
    const puzzle = this.game.play.puzzleDefinition(chapter.id)?.puzzle;
    if (puzzle?.kind !== 'find') return;
    const p = this.game.play.puzzleProgress(chapter.id);
    const scene = box(panel, 'FindScene', 0, 137, 600, 210);
    this.picture(scene, chapter.memoryId, 590, 204, 0, 0);
    for (const spot of puzzle.hotspots) button(scene, 'Clue_' + spot.id, p.found.includes(spot.id) ? '✓' : '?', spot.x, spot.y * .65, 72, 72,
      () => this.puzzle('find', spot.id), p.found.includes(spot.id));
    const clues = puzzle.hotspots.filter((h) => p.found.includes(h.id)).map((h) => h.clue).join('\n');
    text(panel, clues || '点击画面里的三个标记，把找到的线索记下来。', 0, -20, 610, 94, 21);
    text(panel, `抽屉密码  ${p.code.padEnd(puzzle.solution.length, '＿')}`, 0, -94, 500, 44, 28);
    for (let i = 0; i < 10; i++) button(panel, 'PuzzleDigit_' + i, String(i), -224 + i % 5 * 112, -148 - Math.floor(i / 5) * 60, 96, 52, () => this.puzzle('digit', String(i)));
    button(panel, 'PuzzleErase', '退格', 269, -94, 76, 44, () => this.puzzle('erase'));
  }
  private sequencePuzzle(panel: Node, chapter: AdventureChapter): void {
    const puzzle = this.game.play.puzzleDefinition(chapter.id)?.puzzle;
    if (puzzle?.kind !== 'sequence') return;
    const p = this.game.play.puzzleProgress(chapter.id);
    puzzle.tiles.forEach((tile, i) => {
      const card = button(panel, 'Letter_' + tile.id, '', i % 2 ? 156 : -156, i < 2 ? 144 : -13, 294, 140,
        () => this.puzzle('select', tile.id), p.selected.includes(tile.id));
      text(card, tile.label, 0, 31, 270, 44, 28, p.selected.includes(tile.id) ? '#FFFFFF' : '#825A54');
      text(card, tile.clue, 0, -30, 263, 65, 21, p.selected.includes(tile.id) ? '#FFFFFF' : '#825A54');
    });
    const tiles = puzzle.tiles;
    text(panel, p.selected.length ? p.selected.map((id) => tiles.find((t) => t.id === id)?.label).join(' → ') : '依次选择四封信', 0, -157, 610, 88, 25);
    text(panel, '点击已经选过的信，可从那里重新排列', 0, -220, 590, 40, 20);
  }
  private circuitPuzzle(panel: Node, chapter: AdventureChapter): void {
    const puzzle = this.game.play.puzzleDefinition(chapter.id)?.puzzle;
    if (puzzle?.kind !== 'circuit') return;
    const circuit = this.game.play.circuit(chapter.id); if (!circuit) return;
    text(panel, '入口 →                         → 爱心', 0, 222, 550, 36, 21);
    text(panel, '入 →', -263, 133 - Math.floor(puzzle.start / puzzle.columns) * 140, 74, 44, 24);
    text(panel, '→ ♥', 263, 133 - Math.floor(puzzle.end / puzzle.columns) * 140, 74, 44, 24);
    circuit.ports.forEach((ports, index) => {
      const lit = circuit.lit.includes(index);
      const tile = button(panel, 'Circuit_' + index, '', -150 + index % puzzle.columns * 150, 133 - Math.floor(index / puzzle.columns) * 140, 130, 124,
        () => this.puzzle('rotate', String(index)), lit);
      const wire = createUiNode('CircuitWire'); tile.addChild(wire);
      const g = wire.addComponent(Graphics); g.lineWidth = 15; g.strokeColor = hexColor(lit ? '#FFE797' : '#9D8F86');
      for (const port of ports) { g.moveTo(0, 0); g.lineTo([0, 60, 0, -60][port], [57, 0, -57, 0][port]); g.stroke(); }
      g.fillColor = hexColor('#FFF9EF'); g.circle(0, 0, 10); g.fill();
    });
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
    this.picture(panel, chapter.memoryId, 590, 260, 0, 177);
    text(panel, p.claimed ? '这段回忆和纪念物，已经珍藏 ♥' : '心意已送达，这一页回忆为你展开 ♥', 0, 0, 610, 50, 27);
    const r = chapter.reward;
    text(panel, `金币 +${r.coins} · 爱心 +${r.hearts} · 体力 +${r.energy}（至上限）\n剪刀 +${r.scissors} · ${p.claimed ? '一次性奖励已领取' : '完成后可领取一次'}`, 0, -65, 610, 72, 22);
    text(panel, `家园纪念：${chapter.souvenir.title}`, 0, -125, 600, 40, 23);
    if (p.claimed) {
      const journey = this.game.play.journeyProgress();
      const next = journey.nextChapter;
      if (!next) {
        text(panel, '六章旅程已珍藏\n之后仍可继续经营小屋', 0, -183, 610, 64, 22);
        button(panel, 'JourneyContinue', this.isFinalChapter(chapter.id) ? '重看婚礼来信 ›' : '继续经营小屋 ›', 0, -275, 500, 104, () => {
          if (this.isFinalChapter(chapter.id)) this.showWeddingEnding();
          else { this.root.active = false; this.goHome(); this.changed(); }
        }, true);
      } else if (journey.availability?.available) {
        text(panel, `下一章：${next.title}`, 0, -183, 610, 64, 22);
        button(panel, 'JourneyContinue', '继续下一章 ›', 0, -275, 500, 104,
          () => this.openChapter(next.id), true);
      } else {
        text(panel, `下一章尚未解锁\n${this.chapterLockText(next.id)}`, 0, -183, 620, 64, 22);
        button(panel, 'JourneyContinue', '回合成继续经营 ›', 0, -275, 500, 104, () => {
          this.root.active = false; this.goMerge(); this.changed();
        }, true);
      }
      button(panel, 'AdventureReplay', '重玩谜题', -200, -389, 190, 104, () => this.openReplay(chapter.id), true);
      button(panel, 'AdventureMemory', '查看纪念', 0, -389, 190, 104, () => {
        this.root.active = false; this.readMemory(chapter.memoryId); this.changed();
      });
      button(panel, 'JourneyHome', '装扮小屋', 200, -389, 190, 104, () => {
        this.root.active = false; this.goHome(); this.changed();
      });
      text(panel, '练习独立保存 · 不消耗体力 · 不重复发奖', 0, -463, 620, 36, 22);
    } else {
      button(panel, 'AdventureClaim', '领取回忆与纪念物', 0, -275, 500, 104,
        () => this.action('claim', chapter.id, '回忆与纪念物已珍藏，奖励已领取 ♥'), true);
      text(panel, '纪念物会出现在对应房间\n点击可再看这段故事', 0, -389, 630, 64, 22);
    }
  }
}
