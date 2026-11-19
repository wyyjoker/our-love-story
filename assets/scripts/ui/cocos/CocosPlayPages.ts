import { BlockInputEvents, Button, Graphics, Label, Node, tween, UIOpacity, Vec3 } from 'cc';
import type { GameContext } from '../../gameplay/GameContext';
import { WEDDING_CHAPTER_ID, type AdventureChapter, type PlayResult, type ReplayProgress } from '../../core/play/types';
import type { UiRoots } from './UiFactory';
import { applyArt, applyMaterialFrame, itemArt } from './CocosArt';
import { CocosTheme, createUiNode, ensureOpacity, ensureTransform, hexColor, makeLabel, paintRoundRect, paintTactileButton, pressButton } from './CocosTheme';

function text(parent: Node, value: string, x: number, y: number, width = 590, height = 48, size = 24, color = '#825A54'): Label {
  const l = makeLabel(value, size, hexColor(color));
  parent.addChild(l.node); ensureTransform(l.node, width, height); l.node.setPosition(x, y, 0);
  l.enableWrapText = true; l.overflow = Label.Overflow.SHRINK; l.lineHeight = size + 8;
  return l;
}
function box(parent: Node, name: string, x: number, y: number, width: number, height: number, fill = '#FFF0E9', paperFrame = true): Node {
  const n = createUiNode(name); parent.addChild(n); ensureTransform(n, width, height); n.setPosition(x, y, 0);
  paintRoundRect(n.addComponent(Graphics), width, height, 20, hexColor(fill), hexColor('#EDD9CD'), 1);
  if (paperFrame && width >= 300 && height >= 160 && !name.includes('Shield')) applyMaterialFrame(n, 'paper', width, height);
  return n;
}
function button(parent: Node, name: string, caption: string, x: number, y: number, width: number, height: number, tap: () => void, selected = false): Node {
  const n = box(parent, name, x, y, width, height, selected ? '#E993A3' : '#FFFDF6');
  paintTactileButton(n.getComponent(Graphics)!,width,height,selected?'rose':'cream');
  text(n, caption, 0, 0, width - 14, height - 6, 23, selected ? '#FFFFFF' : '#825A54');
  pressButton(n); n.on(Button.EventType.CLICK, tap); return n;
}
const failures: Record<Exclude<PlayResult, { ok: true }>['reason'], string> = {
  LOCKED: '这段谜题暂时无法打开', NOT_READY: '先完成谜题，再回来领取吧',
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
  private highlightedWarehouseUid: string | null = null;
  private backpackExpansionQuote: { capacity: number; cost: number } | null = null;
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
  openTools(focusUid?: string): void {
    this.clearToast();
    this.highlightedWarehouseUid = focusUid ?? null; this.backpackExpansionQuote = null;
    this.screen = 'tools'; this.root.active = true;
    this.render(); this.changed();
  }
  openChapter(id: string): void {
    if (!this.game.play.isAvailable(id)) { this.toast(failures.LOCKED); return; }
    if (this.game.play.progress(id).claimed) { this.openReplay(id); return; }
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
    if (result.ok && action === 'claim' && value === WEDDING_CHAPTER_ID) this.showWeddingEnding();
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
    const hub = this.screen === 'hub';
    const panelHeight = hub ? 1100 : 970;
    const panel = box(this.root, 'PlayPanel', 0, 0, 690, panelHeight, '#FFF8F1', !hub);
    const scale = Math.min(1, (this.roots.designHeight - 90) / panelHeight, (this.roots.designWidth - 32) / 690);
    panel.setScale(scale, scale, 1);
    if (hub) { this.hub(panel); return; }
    text(panel, this.screen === 'date' ? '小约会' : this.definition()?.title ?? '', -30, 429, 500, 55, 31);
    button(panel, 'PlayClose', '关闭', 272, 431, 90, 48, () => this.close());
    if (this.screen === 'date') this.smallDate(panel);
    else this.chapter(panel);
  }
  private definition(): AdventureChapter | undefined { return this.game.bundle.adventures.find((c) => c.id === this.chapterId); }
  private showWeddingEnding(): void {
    if (this.openWeddingEnding()) this.close();
    else { this.close(); this.goHome(); this.toast('先珍藏婚礼回忆，再来读这封信吧'); }
  }
  private picture(parent: Node, memoryId: string, width: number, height: number, x: number, y: number, focusY?: number): Node {
    const memory = this.game.bundle.memories.find((m) => m.id === memoryId)!;
    const n = createUiNode('AdventureIllustration'); parent.addChild(n); n.setPosition(x, y, 0);
    applyArt(n, { sheet: memory.art.split('#')[0], cropToFill: true, cropFocusY: focusY ?? memory.artFocusY ?? .2 }, width, height);
    return n;
  }
  private hub(panel: Node): void {
    const leftText = (parent: Node, name: string, content: string, left: number, y: number, width: number, height: number, size: number, color = '#795447', bold = false): Label => {
      const label = text(parent, content, left + width / 2, y, width, height, size, color);
      label.node.name = name;
      label.horizontalAlign = Label.HorizontalAlign.LEFT;
      label.isBold = bold;
      return label;
    };
    leftText(panel, 'AdventureHubTitle', '我们的旅程', -283, 475, 384, 74, 38, '#684337', true);
    button(panel, 'PlayClose', '关闭', 242, 475, 122, 76, () => this.close());

    const rowWidth = 626;
    const gap = 16;
    let nextTop = 420;
    const useRow = (height: number): number => {
      const center = nextTop - height / 2;
      nextTop -= height + gap;
      return center;
    };
    const journey = this.game.play.journeyProgress();
    const next = journey.nextChapter;
    const summary = box(panel, 'JourneySummary', 0, useRow(154), rowWidth, 154, '#F8EBDD', false);
    leftText(summary, 'JourneyCount', `旅程 ${journey.completed} / ${journey.total}`, -283, 41, 380, 34, 26, '#93575C', true);
    const recommendation = next ? `下一章：${next.title}` : '每一段回忆都已珍藏';
    leftText(summary, 'JourneyRecommendation', recommendation, -283, -7, 380, 58, 23);
    button(summary, 'JourneyNextStep', next ? '继续 ›' : '婚礼来信 ›', 206, 10, 156, 104, () => {
      if (!next) { this.showWeddingEnding(); return; }
      this.openChapter(next.id);
    }, !!next);
    const trackWidth = rowWidth - 60;
    box(summary, 'JourneyProgressTrack', 0, -57, trackWidth, 10, '#E8D5C5');
    if (journey.completed > 0) {
      const fillWidth = trackWidth * journey.completed / Math.max(1, journey.total);
      box(summary, 'JourneyProgressFill', (fillWidth - trackWidth) / 2, -57, fillWidth, 10, '#D88A99');
    }
    const pages = Math.max(1, Math.ceil(this.game.bundle.adventures.length / this.hubPageSize));
    this.hubPage = Math.max(0, Math.min(this.hubPage, pages - 1));
    const firstChapter = this.hubPage * this.hubPageSize;
    const chapters = this.game.bundle.adventures.slice(firstChapter, firstChapter + this.hubPageSize);
    for (const chapter of chapters) {
      const p = this.game.play.progress(chapter.id);
      const recommended = journey.nextChapter?.id === chapter.id;
      const fill = recommended ? '#FFE3DA' : '#FFEEE7';
      const card = box(panel, 'Adventure_' + chapter.id, 0, useRow(240), rowWidth, 240, fill, false);
      const portrait = box(card, 'AdventurePortrait', -207, 0, 166, 192, '#F3DDCB');
      if (p.claimed || recommended || this.game.life.state.unlockedMemoryIds.includes(chapter.memoryId)) {
        this.picture(portrait, chapter.memoryId, 154, 180, 0, 0);
      } else text(portrait, '✦', 0, 0, 132, 156, 36);
      const contentLeft = -101;
      const contentWidth = 388;
      const contentCenter = contentLeft + contentWidth / 2;
      leftText(card, 'AdventureCardTitle', chapter.title, contentLeft, 67, contentWidth, 62, 28, '#6C483A', true);
      const caption = p.claimed ? '已完成 · 纪念已珍藏'
        : p.outcome !== 'playing' ? '谜题已完成 · 可领取纪念'
        : '等待探索';
      leftText(card, 'AdventureCardCaption', caption, contentLeft, 15, contentWidth, 36, 23, '#865D50');
      if (p.claimed) {
        button(card, 'AdventureReplay_' + chapter.id, '重玩谜题', -8, -61, 186, 96,
          () => this.openReplay(chapter.id), true);
        button(card, 'AdventureMemory_' + chapter.id, '查看纪念', 194, -61, 186, 96, () => {
          this.root.active = false; this.readMemory(chapter.memoryId); this.changed();
        });
      } else {
        button(card, 'AdventureOpen_' + chapter.id, recommended ? '继续探索 ›' : '开始探索 ›', contentCenter, -61, contentWidth, 96,
          () => this.openChapter(chapter.id), recommended);
      }
    }
    nextTop -= (this.hubPageSize - chapters.length) * (240 + gap);
    const date = this.game.play.smallDateOrder();
    const dateCard = box(panel, 'SmallDateEntry', 0, useRow(100), rowWidth, 100, '#FFF0E2');
    if (date) {
      leftText(dateCard, 'AdventureDateTitle', '小约会 · ' + date.template.title, -283, 20, 410, 36, 24, '#93575C', true);
      leftText(dateCard, 'AdventureDateCaption', `已完成 ${date.completed} 次 · ${date.ready ? '心意已备齐' : '备好心意再出发'}`, -283, -21, 410, 34, 22);
      button(dateCard, 'SmallDateOpen', '去赴约 ›', 221, 0, 144, 82, () => this.openDate(), true);
    } else {
      leftText(dateCard, 'AdventureDateTitle', '小约会 · 准备中', -283, 20, 410, 36, 24, '#93575C', true);
      leftText(dateCard, 'AdventureDateCaption', '解锁更多物品，开启小约会', -283, -21, 410, 34, 22);
      button(dateCard, 'SmallDateMerge', '回合成页', 221, 0, 144, 82, () => { this.root.active = false; this.goMerge(); this.changed(); });
    }
    const pagingY = useRow(92);
    if (pages > 1) {
      button(panel, 'HubPrev', '‹ 上一页', -208, pagingY, 188, 92, () => { this.hubPage = (this.hubPage - 1 + pages) % pages; this.render(); });
      text(panel, `${this.hubPage + 1} / ${pages}`, 0, pagingY, 120, 42, 24);
      button(panel, 'HubNext', '下一页 ›', 208, pagingY, 188, 92, () => { this.hubPage = (this.hubPage + 1) % pages; this.render(); });
    } else {
      text(panel, '全部章节已在此页', 0, pagingY, 300, 34, 22);
    }
    text(panel, '提示免费 · 可跳过谜题 · 重玩不重复发奖', 0, useRow(38), 566, 38, 21).node.name = 'AdventureHubFooter';
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
    const state = this.game.play.state, status = this.game.getBackpackStatus();
    const panel = box(this.root, 'PlayPanel', 0, 0, 690, 1080, '#C79D75');
    const scale = Math.min(1, (this.roots.designHeight - 80) / 1080, (this.roots.designWidth - 28) / 690);
    panel.setScale(scale, scale, 1);
    panel.getComponent(Graphics)!.clear(); applyMaterialFrame(panel, 'backpack', 690, 1080);
    const bag = createUiNode('BackpackHeaderArt'); panel.addChild(bag); bag.setPosition(-266, 449, 0);
    applyArt(bag, { sheet:'scissors_backpack_sheet', index:5, columns:3, rows:2, preserveAspect:true }, 62, 66);
    text(panel, '随身背包', -58, 449, 320, 46, 31).node.name = 'BackpackTitle';
    button(panel, 'PlayClose', '×', 278, 449, 64, 64, () => this.close());
    text(panel, `${status.used}/${status.capacity} 格  ·  最多36格`, -96, 389, 400, 32, 24, '#A66567');
    text(panel, `◆ ${this.game.player.diamonds}`, 216, 389, 172, 32, 24, '#9775A8');
    for (let i = 0; i < status.maxCapacity; i++) {
      const item = state.warehouse[i];
      const locked = i >= status.capacity, next = i === status.capacity;
      const highlighted = !!item && item.uid === this.highlightedWarehouseUid;
      const slot = button(panel, 'Warehouse_' + i, locked && next ? '◆\n扩容' : '', -250 + i % 6 * 100, 318 - Math.floor(i / 6) * 100, 94, 94,
        () => {
          if (locked) { if (next) this.requestBackpackExpansion(); else this.toast('逐格扩容，下一格可用钻石解锁'); return; }
          if (item) this.action('withdraw', item.uid, '已取回棋盘');
          else this.toast('把棋盘上的物品或生成器拖到背包图标即可收纳');
        }, highlighted);
      paintRoundRect(slot.getComponent(Graphics)!, 94, 94, 12,
        hexColor(highlighted ? '#F7DDD6' : locked ? '#F1E7D8' : '#FFF7E8'), hexColor(next || highlighted ? '#D9978C' : '#DECAB2'), next || highlighted ? 2 : 1);
      if (locked && !next) {
        const lock = createUiNode('BackpackSlotLock'); slot.addChild(lock); const glyph = lock.addComponent(Graphics);
        glyph.strokeColor = hexColor('#B89973'); glyph.lineWidth = 2.5; glyph.roundRect(-7, 0, 14, 19, 7); glyph.stroke();
        glyph.fillColor = hexColor('#C6AA84'); glyph.roundRect(-11, -11, 22, 18, 3); glyph.fill();
        glyph.fillColor = hexColor('#FAF1E3'); glyph.circle(0, -1, 2); glyph.fill(); lock.pauseSystemEvents(true);
      }
      if (locked) { ensureOpacity(slot).opacity = next ? 255 : 130; continue; }
      if (!item) { text(slot, '·', 0, 0, 60, 60, 30, '#CFBBA4'); continue; }
      const definition = this.game.bundle.catalog.get(item.definitionId);
      const icon = createUiNode('StoredItem'); slot.addChild(icon); icon.setPosition(0, 8, 0);
      const art = itemArt(item.definitionId); if (art) applyArt(icon, { ...art, preserveAspect:true }, 70, 62);
      text(slot, definition?.maxUses ? `余${item.remainingUses ?? definition.maxUses}次` : `Lv.${definition?.level ?? '—'}`, 0, -31, 88, 26, 18, '#A8786D');
    }
    const tapHint = box(panel, 'BackpackTapHint', 0, -262, 612, 54, '#F9EDDD');
    text(tapHint, '点击物品取回棋盘', 0, 0, 580, 44, 24);
    const expand = button(panel, 'BackpackExpand', status.nextCost === null ? '已达到36格上限' : `扩容1格   ◆ ${status.nextCost}`, 0, -332, 612, 68,
      () => this.requestBackpackExpansion(), status.affordable);
    expand.getComponent(Button)!.interactable = status.nextCost !== null && status.affordable;
    if (!status.affordable) ensureOpacity(expand).opacity = 160;
    text(panel, status.nextCost === null ? '收纳空间已全部解锁' : status.affordable ? '费用逐格递增 · 确认后消耗钻石' : '钻石不足 · 任务与宝箱可获得钻石', 0, -383, 620, 30, 20, '#A48071');
    const stock = box(panel, 'ScissorsStockCard', 0, -440, 612, 72, '#F6EEE4');
    const scissors = createUiNode('ScissorsStockArt'); stock.addChild(scissors); scissors.setPosition(-253, 0, 0);
    const scissorsArt = itemArt('scissors_01'); if (scissorsArt) applyArt(scissors, { ...scissorsArt, preserveAspect:true }, 62, 62);
    text(stock, `待取剪刀 ×${state.scissors}`, -83, 0, 250, 38, 24);
    button(stock, 'TakeScissors', state.scissors ? '取出剪刀' : '库存已取完', 190, 0, 184, 58, () => this.action('take_scissors', ''), state.scissors > 0).getComponent(Button)!.interactable = state.scissors > 0;
    text(panel, '物品与生成器均可收纳 · 取回棋盘后使用', 0, -492, 596, 26, 20, '#8B6B56');
    if (this.backpackExpansionQuote) this.renderBackpackExpansion(panel);
  }
  private requestBackpackExpansion(): void {
    const status = this.game.getBackpackStatus();
    if (status.nextCost === null) { this.toast('背包已达到36格上限'); return; }
    if (!status.affordable) { this.toast('钻石不足，可从任务和宝箱获得'); return; }
    this.backpackExpansionQuote = { capacity: status.capacity, cost: status.nextCost }; this.render();
  }
  private renderBackpackExpansion(panel: Node): void {
    const quote = this.backpackExpansionQuote!;
    const shield = box(panel, 'BackpackExpandShield', 0, 0, 690, 1080, '#735747'); ensureOpacity(shield).opacity = 130; shield.addComponent(BlockInputEvents);
    const dialog = box(panel, 'BackpackExpandConfirm', 0, 30, 566, 300, '#FFF7E9'); dialog.addComponent(BlockInputEvents);
    text(dialog, '扩充随身背包', 0, 99, 520, 48, 31);
    text(dialog, `${quote.capacity}格 → ${quote.capacity + 1}格  ·  消耗 ◆ ${quote.cost}`, 0, 30, 520, 52, 25);
    text(dialog, '确认后立即增加一个可收纳空位', 0, -20, 520, 34, 20, '#A48071');
    button(dialog, 'BackpackExpandCancel', '再想想', -128, -93, 222, 62, () => { this.backpackExpansionQuote = null; this.render(); });
    button(dialog, 'BackpackExpandConfirmButton', '确认扩容', 128, -93, 222, 62, () => {
      const result = this.game.expandBackpack(quote.capacity, quote.cost); this.backpackExpansionQuote = null;
      this.toast(result.ok ? `背包已扩至${result.capacity}格` : result.reason === 'NOT_ENOUGH_DIAMONDS' ? '钻石不足，未扣除钻石' : result.reason === 'MAX_CAPACITY' ? '已达到36格上限' : '扩容状态已更新，请重新确认');
      this.render(); this.changed();
    }, true);
  }
  private chapter(panel: Node): void {
    const chapter = this.definition(); if (!chapter) return;
    const replay = this.game.play.replayProgress(chapter.id);
    if (replay) { this.replayChapter(panel, chapter, replay); return; }
    const p = this.game.play.progress(chapter.id);
    button(panel, 'AdventureBack', '‹ 约会目录', -232, 368, 170, 42, () => this.openHub());
    text(panel, p.claimed ? '已珍藏' : p.outcome === 'playing' ? '探索中' : '待领取', 110, 368, 350, 42, 22);
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
    text(panel, hint, 0, -289, 610, 70, 21);
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
    const columns = puzzle.tiles.length > 4 ? 3 : 2;
    const spacing = columns === 3 ? 202 : 312;
    const cardWidth = spacing - 16;
    puzzle.tiles.forEach((tile, i) => {
      const selectedAt = p.selected.indexOf(tile.id);
      const x = (i % columns - (columns - 1) / 2) * spacing;
      const y = i < columns ? 144 : -13;
      const card = button(panel, 'Letter_' + tile.id, '', x, y, cardWidth, 140,
        () => this.puzzle('select', tile.id), selectedAt >= 0);
      const fold = createUiNode('EnvelopeFold');
      card.addChild(fold);
      const ink = fold.addComponent(Graphics);
      ink.strokeColor = hexColor(selectedAt >= 0 ? '#FFF0E4' : '#E2C9AB', 180);
      ink.lineWidth = 2;
      const edge = cardWidth / 2 - 14;
      ink.moveTo(-edge, 51); ink.lineTo(0, -2); ink.lineTo(edge, 51); ink.stroke();
      const seal = createUiNode('LetterSeal');
      card.addChild(seal); seal.setPosition(-cardWidth / 2 + 33, 28, 0);
      const wax = seal.addComponent(Graphics);
      wax.fillColor = hexColor(selectedAt >= 0 ? '#AD6475' : '#DE9DA0');
      wax.circle(0, 0, 19); wax.fill();
      text(seal, selectedAt >= 0 ? String(selectedAt + 1) : '♥', 0, 0, 34, 34, 21, '#FFF9EA');
      const color = selectedAt >= 0 ? '#FFFDF4' : '#825A54';
      text(card, tile.label, 20, 31, cardWidth - 64, 44, columns === 3 ? 22 : 28, color);
      text(card, tile.clue, 0, -34, cardWidth - 28, 59, columns === 3 ? 19 : 21, color);
    });
    const slotWidth = Math.min(136, 570 / puzzle.tiles.length - 8);
    puzzle.tiles.forEach((_, index) => {
      const tile = puzzle.tiles.find(entry => entry.id === p.selected[index]);
      const x = (index - (puzzle.tiles.length - 1) / 2) * (slotWidth + 8);
      const slot = box(panel, 'LetterSequenceSlot_' + index, x, -155, slotWidth, 68, tile ? '#F1DBCB' : '#FBF1DE');
      text(slot, tile?.label ?? String(index + 1), 0, 0, slotWidth - 12, 48, tile ? 21 : 25, tile ? '#854D50' : '#BB9E7F');
    });
    text(panel, p.selected.length ? '轻点已选信件可从那一封重新排列' : '依次点信封，把心意放进下面的顺序格',
      0, -220, 590, 40, 20);
  }
  private circuitPuzzle(panel: Node, chapter: AdventureChapter): void {
    const puzzle = this.game.play.puzzleDefinition(chapter.id)?.puzzle;
    if (puzzle?.kind !== 'circuit') return;
    const circuit = this.game.play.circuit(chapter.id); if (!circuit) return;
    this.picture(panel, chapter.memoryId, 596, 52, 0, 216, .02);
    const rowY = (index: number) => 123 - Math.floor(index / puzzle.columns) * 134;
    text(panel, '入 →', -263, rowY(puzzle.start), 74, 44, 24, '#947045');
    text(panel, '→ ♥', 263, rowY(puzzle.end), 74, 44, 24, '#B4626A');
    circuit.ports.forEach((ports, index) => {
      const lit = circuit.lit.includes(index);
      const x = (index % puzzle.columns - (puzzle.columns - 1) / 2) * 150;
      const tile = button(panel, 'Circuit_' + index, '', x, rowY(index), 132, 122,
        () => this.puzzle('rotate', String(index)));
      paintRoundRect(tile.getComponent(Graphics)!, 132, 122, 16,
        hexColor(lit ? '#EEF1D9' : '#FFF4DD'), hexColor(lit ? '#A9B88B' : '#DFC29E'), 2);
      const wire = createUiNode('CircuitWire'); tile.addChild(wire);
      const ink = wire.addComponent(Graphics);
      for (const [lineWidth, color] of [[21, lit ? '#9CAE75' : '#B4A38C'], [13, lit ? '#F4DC8E' : '#CEC1AE'], [4, lit ? '#FFF4C8' : '#ECE1D1']] as const) {
        ink.lineWidth = lineWidth; ink.strokeColor = hexColor(color);
        for (const port of ports) {
          ink.moveTo(0, 0); ink.lineTo([0, 64, 0, -64][port], [59, 0, -59, 0][port]); ink.stroke();
        }
      }
      ink.fillColor = hexColor(lit ? '#FFF6D1' : '#F7E8CE');
      ink.circle(0, 0, 10); ink.fill();
    });
    const corner = (index: number): string => {
      const row = Math.floor(index / puzzle.columns), column = index % puzzle.columns;
      const vertical = row === 0 ? '上' : row === puzzle.rows - 1 ? '下' : '';
      const horizontal = column === 0 ? '左' : column === puzzle.columns - 1 ? '右' : '';
      return `${vertical}${horizontal}` || '入口';
    };
    const entry = corner(puzzle.start) === '入口' ? '左侧中间' : corner(puzzle.start);
    const exit = corner(puzzle.end) === '入口' ? '右侧中间' : corner(puzzle.end);
    text(panel, `${entry}连入 · ${exit}连出 · 点格子旋转`, 0, -232, 590, 36, 21);
  }
  private completed(panel: Node, chapter: AdventureChapter): void {
    const p = this.game.play.progress(chapter.id);
    this.picture(panel, chapter.memoryId, 590, 260, 0, 177);
    const souvenir = chapter.souvenir;
    text(panel, p.claimed ? '这段回忆已经珍藏 ♥' : '线索已经收好，这一页回忆为你展开 ♥', 0, 0, 610, 50, 27);
    const r = chapter.reward;
    const gift=r.generator,extra=gift?`${this.game.generators.get(gift.generatorId)?.displayName??'生成器'} Lv${gift.level} ×${gift.count}`:p.claimed?'一次性奖励已领取':'完成后可领取一次';
    const rewards = [`金币 +${r.coins}`, `爱心 +${r.hearts}`];
    if (r.energy > 0) rewards.push(`体力 +${r.energy}`);
    if (r.scissors > 0) rewards.push(`剪刀 +${r.scissors}`);
    text(panel, `${rewards.join(' · ')}\n${extra}`, 0, -65, 610, 72, 22);
    text(panel, souvenir ? `家园纪念：${souvenir.title}` : '珍藏后可在回忆相册中重读', 0, -125, 600, 40, 23);
    if (p.claimed) {
      const journey = this.game.play.journeyProgress();
      const next = journey.nextChapter;
      if (!next) {
        text(panel, `${journey.total} 段回忆已全部珍藏\n之后仍可继续经营小屋`, 0, -171, 610, 58, 22);
        button(panel, 'JourneyContinue', '继续经营小屋 ›', 0, -253, 500, 104, () => {
          this.root.active = false; this.goHome(); this.changed();
        }, true);
      } else {
        text(panel, `下一章：${next.title}`, 0, -171, 610, 58, 22);
        button(panel, 'JourneyContinue', '继续下一章 ›', 0, -253, 500, 104,
          () => this.openChapter(next.id), true);
      }
      button(panel, 'AdventureReplay', '重玩谜题', -200, -367, 190, 104, () => this.openReplay(chapter.id), true);
      button(panel, 'AdventureMemory', '查看纪念', 0, -367, 190, 104, () => {
        this.root.active = false; this.readMemory(chapter.memoryId); this.changed();
      });
      button(panel, 'JourneyHome', '装扮小屋', 200, -367, 190, 104, () => {
        this.root.active = false; this.goHome(); this.changed();
      });
      text(panel, '练习独立保存 · 不消耗体力 · 不重复发奖', 0, -443, 620, 32, 22);
    } else {
      button(panel, 'AdventureClaim', souvenir ? '领取回忆与纪念物' : '珍藏回忆并领奖', 0, -275, 500, 104,
        () => this.action('claim', chapter.id, '回忆已珍藏，奖励已领取 ♥'), true);
      if (souvenir) text(panel, '纪念物会出现在对应房间\n点击可再看这段故事', 0, -389, 630, 64, 22);
    }
  }
}
