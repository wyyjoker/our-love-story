import { BlockInputEvents, Button, Event, Graphics, Label, Mask, Node, ScrollView, UITransform } from 'cc';
import type { GameContext } from '../../gameplay/GameContext';
import type { UiRoots } from './UiFactory';
import { applyArt, itemArt, type ArtCell } from './CocosArt';
import { CocosTheme, createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect } from './CocosTheme';
import { claimedCheckInDays, previewEnergyReplenishment } from './RewardUiMath';

type PendingAction = { index: number; expectedUid: string; title: string; detail: string; unit: string; chest: boolean };

function addText(parent: Node, text: string, x: number, y: number, width: number, height: number, size = 20, bold = false): Label {
  const label = makeLabel(text, size, CocosTheme.textPrimary(), bold);
  parent.addChild(label.node);
  ensureTransform(label.node, width, height);
  label.overflow = Label.Overflow.SHRINK;
  label.node.setPosition(x, y, 0);
  return label;
}

function addButton(parent: Node, name: string, caption: string, x: number, y: number, width: number, height: number, onClick: () => void, enabled = true): Node {
  const node = createUiNode(name);
  parent.addChild(node);
  ensureTransform(node, width, height);
  node.setPosition(x, y, 0);
  paintRoundRect(node.addComponent(Graphics), width, height, Math.min(24, height / 2), enabled ? CocosTheme.primary() : hexColor('#E5DAD4'));
  addText(node, caption, 0, 0, width - 10, height - 6, 20, true).color = enabled ? hexColor('#FFFFFF') : hexColor('#8D7468');
  node.addComponent(Button);
  node.on(Button.EventType.CLICK, (event: Event) => { event.propagationStopped = true; if (enabled) onClick(); });
  return node;
}

export class CocosRewardsPanel {
  private readonly root: Node;
  private readonly panel: Node;
  private readonly headerLabel: Label;
  private readonly viewport: Node;
  private readonly scroll: ScrollView;
  private activeTab: 'checkin' | 'daily' | 'supplies' | 'collection' = 'checkin';
  private readonly content: Node;
  private readonly feedback: (message: string, success?: boolean) => void;
  private pending: PendingAction | null = null;
  private readonly confirmLayer: Node;
  private readonly confirmText: Label;
  private readonly onClose?: () => void;
  private readonly onOpenTools?: () => void;
  private readonly onOpenGeneratorWorkshop?: () => void;
  private readonly onOpenJournal?: () => void;
  private readonly onOpenCollection?: (chainId: string) => void;

  constructor(private readonly game: GameContext, roots: UiRoots, feedback: (message: string, success?: boolean) => void, onClose?: () => void, onOpenTools?: () => void, onOpenGeneratorWorkshop?: () => void, onOpenJournal?: () => void, onOpenCollection?: (chainId: string) => void, private readonly onOpenChest?: (index: number, uid: string) => void) {
    this.feedback = feedback;
    this.onClose = onClose;
    this.onOpenTools = onOpenTools;
    this.onOpenGeneratorWorkshop = onOpenGeneratorWorkshop;
    this.onOpenJournal = onOpenJournal;
    this.onOpenCollection = onOpenCollection;
    this.root = createUiNode('RewardsOverlay');
    roots.modalLayer.addChild(this.root);
    ensureTransform(this.root, roots.designWidth, roots.designHeight);
    this.root.addComponent(BlockInputEvents);
    this.root.active = false;
    paintRoundRect(this.root.addComponent(Graphics), roots.designWidth, roots.designHeight, 0, hexColor('#362B2B', 174));

    this.panel = createUiNode('RewardsPanel');
    this.root.addChild(this.panel);
    ensureTransform(this.panel, 700, 960);
    const scale = Math.min(1, (roots.designHeight - 32) / 960, (roots.designWidth - 24) / 700);
    this.panel.setScale(scale, scale, 1);
    paintRoundRect(this.panel.addComponent(Graphics), 700, 960, 28, hexColor('#FFF8F1'), hexColor('#EDD9CD'), 2);
    this.headerLabel = addText(this.panel, '小屋补给站', -185, 436, 280, 48, 30, true);
    this.headerLabel.node.name = 'RewardsHeaderTitle';
    const balance = addText(this.panel, '', 91, 436, 200, 40, 24, true); balance.node.name = 'DiamondBalance';
    addButton(this.panel, 'CloseRewards', '关闭', 274, 436, 92, 62, () => this.close());
    addButton(this.panel, 'BackpackButton', '背包 0/6', -212, 366, 180, 64, () => this.openBackpack());
    addButton(this.panel, 'GeneratorWorkshopButton', '生成器', 0, 366, 180, 64, () => this.openGeneratorWorkshop());
    addButton(this.panel, 'OpenTodayJournal', '今日日记', 212, 366, 180, 64, () => this.openJournal());

    for (const name of ['BackpackButton','GeneratorWorkshopButton','OpenTodayJournal']) {
      const shortcut = this.panel.getChildByName(name)!;
      paintRoundRect(shortcut.getComponent(Graphics)!, 180, 64, 20, hexColor('#F3E8DD'), hexColor('#E7D4C7'), 1);
      const caption = shortcut.getComponentInChildren(Label); if (caption) caption.color = hexColor('#896653');
    }

    this.viewport = createUiNode('RewardsViewport');
    this.panel.addChild(this.viewport);
    ensureTransform(this.viewport, 650, 716);
    this.viewport.setPosition(0, -108, 0);
    this.viewport.addComponent(Mask);
    const scroll = this.viewport.addComponent(ScrollView);
    this.scroll = scroll;
    scroll.horizontal = false;
    scroll.vertical = true;
    this.content = createUiNode('RewardsContent');
    this.viewport.addChild(this.content);
    ensureTransform(this.content, 630, 716);
    this.content.getComponent(UITransform)?.setAnchorPoint(0.5, 1);
    this.content.setPosition(0, 358, 0);
    scroll.content = this.content;

    this.confirmLayer = createUiNode('ConfirmConsume');
    this.root.addChild(this.confirmLayer);
    ensureTransform(this.confirmLayer, roots.designWidth, roots.designHeight);
    this.confirmLayer.addComponent(BlockInputEvents);
    paintRoundRect(this.confirmLayer.addComponent(Graphics), roots.designWidth, roots.designHeight, 0, hexColor('#362B2B', 120));
    const confirm = createUiNode('ConfirmCard');
    this.confirmLayer.addChild(confirm);
    ensureTransform(confirm, 560, 280);
    paintRoundRect(confirm.addComponent(Graphics), 560, 280, 24, hexColor('#FFF8F1'), hexColor('#EDD9CD'), 2);
    this.confirmText = addText(confirm, '', 0, 58, 500, 100, 24, true);
    addButton(confirm, 'ConfirmUse', '确认使用', -132, -80, 190, 70, () => this.confirmUse());
    addButton(confirm, 'CancelUse', '再想想', 132, -80, 190, 70, () => this.cancelUse());
    this.confirmLayer.active = false;
  }

  open(tab: 'checkin' | 'daily' | 'supplies' | 'collection' = 'checkin'): void { this.pending = null; this.activeTab = tab; this.root.active = true; this.render(); }
  close(): void { this.pending = null; this.confirmLayer.active = false; this.root.active = false; this.onClose?.(); }

  private render(): void {
    this.headerLabel.string = ({ checkin: '七日签到', daily: '每日任务', supplies: '小屋补给', collection: '收藏图鉴' } as const)[this.activeTab];
    const backpackButton = this.panel.children.find((child) => child.name === 'BackpackButton');
    const backpackLabel = backpackButton?.children[0]?.getComponent(Label);
    if (backpackLabel) backpackLabel.string = `背包 ${this.game.play.state.warehouse.length}/${this.game.config.toolbox.warehouseSlots}`;
    const balance = this.panel.getChildByName('DiamondBalance')?.getComponent(Label);
    if (balance) balance.string = `◆ ${this.game.player.diamonds}`;
    for (const child of [...this.panel.children]) if (child.name.startsWith('RewardsTab_')) child.destroy();
    const tabs = [ ['checkin', '签到'], ['daily', '每日'], ['supplies', '补给'], ['collection', '图鉴'] ] as const;
    tabs.forEach(([key, caption], index) => {
      const tab = addButton(this.panel, `RewardsTab_${key}`, caption, -240 + index * 160, 292, 156, 72, () => { this.activeTab = key; this.render(); });
      if (key !== this.activeTab) {
        paintRoundRect(tab.getComponent(Graphics)!, 156, 72, 22, hexColor('#F2E5DD'), hexColor('#E7D5CA'), 1);
        const tabLabel = tab.children[0]?.getComponent(Label); if (tabLabel) tabLabel.color = hexColor('#80625A');
      }
    });
    for (const child of [...this.content.children]) child.destroy();
    let y = -30;
    const section = (title: string, subtitle?: string): void => {
      const header = addText(this.content, title, -140, y, 330, 38, 25, true); header.horizontalAlign = Label.HorizontalAlign.LEFT;
      if (subtitle) { const note = addText(this.content, subtitle, 160, y, 260, 32, 17); note.horizontalAlign = Label.HorizontalAlign.RIGHT; note.color = CocosTheme.textSecondary(); }
      y -= 52;
    };
    const row = (name: string, detail: string, iconArt?: ArtCell | null, action?: { label: string; click: () => void; buttonName?: string; enabled?: boolean }, rowName = 'RewardRow', onRowClick?: () => void): void => {
      const holder = createUiNode(rowName); this.content.addChild(holder); ensureTransform(holder, 610, 116); holder.setPosition(0, y - 58, 0);
      paintRoundRect(holder.addComponent(Graphics), 610, 112, 18, hexColor('#FFFFFF'), hexColor('#F0DED5'), 1);
      const icon = createUiNode('Icon'); holder.addChild(icon); icon.setPosition(-255, 0, 0);
      if (iconArt) applyArt(icon, { ...iconArt, preserveAspect: true }, 72, 72);
      else { const badge = addText(holder, '✦', -255, 0, 56, 56, 29, true); badge.color = hexColor('#D6A48A'); }
      if (onRowClick) { holder.addComponent(Button); holder.on(Button.EventType.CLICK, (event: Event) => { event.propagationStopped = true; onRowClick(); }); }
      const title = addText(holder, name, -42, 29, 345, 36, 24, true); title.horizontalAlign = Label.HorizontalAlign.LEFT;
      const description = addText(holder, detail, -42, -23, 345, 52, 22); description.horizontalAlign = Label.HorizontalAlign.LEFT; description.color = CocosTheme.textSecondary(); description.enableWrapText = true; description.lineHeight = 26;
      if (action) addButton(holder, action.buttonName ?? 'Action', action.label, 230, 0, 108, 72, action.click, action.enabled ?? true);
      y -= 124;
    };
    if (this.activeTab === 'checkin') {
      const status = this.game.getCheckInStatus(), rewards = this.game.config.rewards.checkIn;
      const claimedDays = new Set(claimedCheckInDays(status, rewards.length));
      const displayDayIndex = status.canClaim ? status.cycleIndex : (status.cycleIndex + rewards.length - 1) % rewards.length;
      const todayReward = rewards[displayDayIndex] ?? rewards[0];
      const today = createUiNode('CheckInTodayCard'); this.content.addChild(today); ensureTransform(today, 610, 112); today.setPosition(0, -68, 0);
      paintRoundRect(today.addComponent(Graphics), 606, 108, 22, status.canClaim ? hexColor('#FFF0DB') : hexColor('#FFFFFF'), status.canClaim ? CocosTheme.primary() : hexColor('#EEDCD2'), status.canClaim ? 2 : 1);
      const todayTitle = addText(today, '今日签到奖励', -182, 30, 250, 32, 23, true); todayTitle.horizontalAlign = Label.HorizontalAlign.LEFT;
      const dayState = addText(today, status.canClaim ? `第 ${displayDayIndex + 1} 天 · 可领取` : `第 ${displayDayIndex + 1} 天 · 今日已领`, 190, 30, 185, 30, 20, true); dayState.color = CocosTheme.primary();
      const rewardGroups = [
        { id: 'coin_01', amount: todayReward?.coins ?? 0, title: '金币' },
        { id: 'energy_01', amount: todayReward?.energy ?? 0, title: '体力' },
        { id: 'diamond_01', amount: todayReward?.diamonds ?? 0, title: '钻石' },
        ...(todayReward?.itemId ? [{ id: todayReward.itemId, amount: 1, title: '剪刀' }] : []),
      ].filter((entry) => entry.amount > 0);
      const groupWidth = rewardGroups.length > 3 ? 140 : 150;
      rewardGroups.forEach((entry, index) => {
        const x = (index - (rewardGroups.length - 1) / 2) * groupWidth;
        const icon = createUiNode(`CheckInToday_${entry.title}Icon`); today.addChild(icon); icon.setPosition(x - 32, -22, 0);
        const art = itemArt(entry.id); if (art) applyArt(icon, { ...art, preserveAspect: true }, 38, 38);
        const amount = addText(today, `+${entry.amount} ${entry.title}`, x + 34, -22, 118, 38, 22, true); amount.horizontalAlign = Label.HorizontalAlign.LEFT;
      });
      addButton(this.content, 'CheckInClaim', status.canClaim ? '领取今日签到' : '今日已领取', 0, -166, 300, 68, () => this.claimCheckIn(), status.canClaim);
      const claimedCount = claimedDays.size;
      const progressTitle = addText(this.content, '七日签到进度', -150, -204, 300, 30, 22, true); progressTitle.horizontalAlign = Label.HorizontalAlign.LEFT;
      const progressCount = addText(this.content, `${claimedCount} / ${rewards.length} 已领取`, 186, -204, 220, 30, 20, true); progressCount.horizontalAlign = Label.HorizontalAlign.RIGHT; progressCount.color = CocosTheme.primary();
      rewards.forEach((reward, index) => {
        const column = index % 3, rowIndex = Math.floor(index / 3);
        const finale = index === rewards.length - 1 && rewards.length % 3 === 1;
        const x = finale ? 0 : -204 + column * 204;
        const centerY = -280 - rowIndex * 142;
        const tileWidth = finale ? 602 : 194;
        const tile = createUiNode(`CheckInDay_${index + 1}`); this.content.addChild(tile); ensureTransform(tile, tileWidth, 128);
        tile.setPosition(x, centerY, 0);
        const claimed = claimedDays.has(index), current = index === status.cycleIndex && status.canClaim;
        paintRoundRect(tile.addComponent(Graphics), tileWidth - 4, 124, 18, current || finale && !claimed ? hexColor('#FFF0DB') : claimed ? hexColor('#F5F0EC') : hexColor('#FFFFFF'), current ? CocosTheme.primary() : hexColor('#EEDCD2'), current ? 2 : 1);
        addText(tile, `第 ${index + 1} 天${finale ? ' · 一周的心意' : ''}`, 0, 41, tileWidth - 24, 27, finale ? 23 : 20, true);
        const parts = [
          { id: 'coin_01', amount: reward.coins },
          { id: 'energy_01', amount: reward.energy },
          { id: 'diamond_01', amount: reward.diamonds },
          ...(reward.itemId ? [{ id: reward.itemId, amount: 1 }] : []),
        ].filter((entry) => entry.amount > 0);
        const partWidth = finale ? 118 : 58;
        parts.forEach((entry, partIndex) => {
          const partX = (partIndex - (parts.length - 1) / 2) * partWidth;
          const icon = createUiNode(`RewardIcon_${entry.id}`); tile.addChild(icon); icon.setPosition(partX - (finale ? 18 : 11), 2, 0);
          const art = itemArt(entry.id); if (art) applyArt(icon, { ...art, preserveAspect: true }, finale ? 34 : 26, finale ? 34 : 26);
          addText(tile, `${entry.amount}`, partX + (finale ? 21 : 13), 2, finale ? 48 : 32, 28, finale ? 23 : 18, true);
        });
        const state = addText(tile, claimed ? '✓ 已领取' : current ? '今日可领' : '待签到', 0, -41, tileWidth - 24, 25, finale ? 20 : 18, true);
        state.color = claimed ? hexColor('#9D8D85') : current ? CocosTheme.primary() : CocosTheme.textSecondary();
      });
      const lastTileBottom = 280 + (Math.ceil(rewards.length / 3) - 1) * 142 + 64;
      y = 55 - lastTileBottom - 16;
    } else if (this.activeTab === 'daily') {
      section('每日任务', '每天都有新的小目标');
      for (const task of this.game.getDailyTasks().tasks) {
        const hiddenTarget = task.targetItemId && !this.game.isItemDiscovered(task.targetItemId);
        const title = hiddenTarget ? '合成 ? 相关物品' : task.title;
        const rewardParts = [task.reward.coins > 0 ? `金币 ${task.reward.coins}` : '', task.reward.xp > 0 ? `经验 ${task.reward.xp}` : '', task.reward.energy > 0 ? `体力 ${task.reward.energy}` : '', task.reward.diamonds > 0 ? `钻石 ${task.reward.diamonds}` : ''].filter(Boolean);
        const detail = `${Math.min(task.progress, task.target)}/${task.target} · ${rewardParts.join(' · ')}`;
        const state = task.claimed ? '已领取' : task.ready ? '领取' : '进行中';
        row(title, detail, task.targetItemId && !hiddenTarget ? itemArt(task.targetItemId) : itemArt('coin_01'), { label: state, buttonName: `DailyTaskClaim_${task.id}`, enabled: task.ready && !task.claimed, click: () => this.claimDailyTask(task.id) }, `DailyTask_${task.id}`);
      }
    } else if (this.activeTab === 'supplies') {
      section('钻石兑换体力', '兑换前会显示实际补充量');
      for (const offer of this.game.config.rewards.exchangeOffers) {
        const amount = previewEnergyReplenishment(this.game.player.maxEnergy, this.game.player.energy, offer.energy);
        row(amount > 0 ? `补充 ${amount} 点体力` : '体力已满', amount > 0 ? `消耗 ${offer.diamonds} 钻石 · 当前 ${this.game.player.diamonds} 钻石` : '使用一些体力后再来补充吧', itemArt('energy_02'), { label: amount > 0 ? '兑换' : '已满', enabled: amount > 0, click: () => this.exchange(offer.id, offer.diamonds) });
      }
      section('棋盘宝箱与补给', '宝箱即点即开，补给可合成');
      const consumables = this.game.board.getBoard().cells.flatMap((cell) => {
        if (cell.locked || !cell.item) return [];
        const definition = this.game.bundle.catalog.get(cell.item.definitionId);
        if (!definition || !['coin','energy','diamond','treasure_chest'].includes(definition.chainId)) return [];
        const value = definition.useValue ?? 0;
        const count = this.game.config.rewards.chestLevels.find((entry) => entry.level === definition.level)?.count ?? 2;
        const detail = definition.chainId === 'treasure_chest' ? `Lv${definition.level} · 点击弹出 ${count} 件随机补给` : definition.chainId === 'energy' ? `使用后 ${this.game.player.energy + value}/${this.game.player.maxEnergy}（可溢出）` : `使用后获得 ${value} ${definition.chainId === 'coin' ? '金币' : '钻石'}`;
        return [{ cell, uid: cell.item.uid, definition, detail }];
      });
      if (!consumables.length) row('暂无可使用物品', '获得补给后可在这里使用', itemArt('treasure_chest'));
      for (const entry of consumables) {
        const chest = entry.definition.chainId === 'treasure_chest', unit = entry.definition.chainId === 'energy' ? '点体力' : entry.definition.chainId === 'coin' ? '金币' : '钻石';
        row(entry.definition.displayName, entry.detail, itemArt(entry.definition.id), { label: chest ? '打开' : '使用', click: () => {
          if (chest && this.onOpenChest) { this.close(); this.onOpenChest(entry.cell.index, entry.uid); }
          else this.askUse(entry.cell.index, entry.uid, entry.definition.displayName, entry.detail, unit, chest);
        } });
      }
      section(`奖励恢复箱 · ${this.game.rewardInbox.length} 件`, '奖励不会丢失');
      if (!this.game.rewardInbox.length) row('恢复箱目前为空', '棋盘放不下的奖励会保存在这里', itemArt('treasure_chest'));
      for (const item of this.game.rewardInbox) {
        const definition = this.game.bundle.catalog.get(item.definitionId);
        row(definition?.displayName ?? '未知奖励', '领取后放入一个开放的空棋盘格', itemArt(item.definitionId), { label: '领取', click: () => this.claimInbox(item.uid) });
      }
    } else {
      section('图鉴收集', '完成一组可提升体力上限');
      for (const collection of this.game.getCollectionProgress()) {
        const known = Array.from(this.game.bundle.catalog.values()).filter((definition) => definition.chainId === collection.chainId && this.game.isItemDiscovered(definition.id)).sort((a,b) => a.level-b.level);
        row(known[0]?.displayName ?? '未发现的图鉴', `收集 ${collection.discovered}/${collection.total} · 体力上限 +${collection.energyBonus}`,
          known[0] ? itemArt(known[0].id) : undefined,
          { label: collection.claimed ? '已领取' : '领取', click: () => this.claimCollection(collection.chainId), buttonName: `CollectionClaim_${collection.chainId}`, enabled: collection.ready && !collection.claimed },
          `Collection_${collection.chainId}`, () => this.openCollection(collection.chainId));
      }
    }
    const contentHeight = Math.max(716, -y + 55);
    ensureTransform(this.content, 630, contentHeight, 0.5, 1);
    this.content.setPosition(0, contentHeight / 2, 0); this.scroll.scrollToTop(0);
    this.confirmLayer.active = !!this.pending;
  }

  private askUse(index: number, expectedUid: string, title: string, detail: string, unit: string, chest: boolean): void {
    this.pending = { index, expectedUid, title, detail, unit, chest };
    this.confirmText.string = `${title}\n${detail}\n${chest ? '确定要打开吗？' : '确定要使用吗？'}`;
    this.confirmLayer.active = true;
  }
  private cancelUse(): void { this.pending = null; this.confirmLayer.active = false; }
  private confirmUse(): void {
    const pending = this.pending;
    if (!pending) return;
    const currentUid = this.game.board.getBoard().cells[pending.index]?.item?.uid;
    const selectedItemChanged = currentUid !== pending.expectedUid;
    const result = this.game.useBoardItem(pending.index, pending.expectedUid);
    if (!result.ok) {
      this.feedback(result.reason === 'ENERGY_FULL'
        ? '暂时不能使用，物品未被消耗'
        : selectedItemChanged ? '棋盘上的物品已变化，未消耗任何物品' : '这个物品现在无法使用');
    } else {
      this.feedback(pending.chest ? '宝箱已打开，奖励已送达' : `已使用，实际获得 ${result.amount} ${pending.unit}`, true);
    }
    this.pending = null;
    this.confirmLayer.active = false;
    this.render();
  }
  private claimInbox(uid: string): void {
    const result = this.game.claimInboxItem(uid);
    this.feedback(result.ok ? '奖励已放入棋盘' : result.reason === 'BOARD_FULL' ? '没有开放的空格，奖励仍保留在恢复箱' : '这件奖励已不可领取', result.ok);
    this.render();
  }
  private exchange(id: string, price: number): void {
    const result = this.game.exchangeDiamonds(id);
    if (!result.ok) {
      const message = result.reason === 'ENERGY_FULL' ? '体力已满，未消耗钻石' : result.reason === 'NOT_ENOUGH_DIAMONDS' ? `钻石不足：需要 ${price}，当前 ${this.game.player.diamonds}` : '暂时无法兑换';
      this.feedback(message);
    } else this.feedback(`已消耗 ${price} 钻石，实际补充 ${result.energy} 点体力`, true);
    this.render();
  }
  private claimCheckIn(): void {
    const result = this.game.claimDailyCheckIn();
    this.feedback(result.ok
      ? `签到奖励已领取：金币 +${result.coins} · 体力 +${result.energy} · 钻石 +${result.diamonds}${result.itemId ? ' · 剪刀已放入恢复箱' : ''}`
      : '今天已经领取过签到奖励了', result.ok);
    this.render();
  }

  private claimDailyTask(id: string): void {
    const result = this.game.claimDailyTask(id);
    this.feedback(result.ok
      ? `任务奖励已领取：金币 +${result.coins} · 经验 +${result.xp} · 体力 +${result.energy} · 钻石 +${result.diamonds}`
      : result.reason === 'NOT_READY' ? '任务还没有完成' : result.reason === 'ALREADY_CLAIMED' ? '奖励已经领取过了' : '任务状态已变化', result.ok);
    this.render();
  }

  private claimCollection(chainId: string): void {
    const result = this.game.claimCollectionBonus(chainId);
    this.feedback(result.ok ? `图鉴奖励领取成功，体力上限增加 ${result.energyBonus}` : result.reason === 'NOT_READY' ? '图鉴还没有收集完成' : '这份图鉴奖励已领取', result.ok);
    this.render();
  }

  private openBackpack(): void {
    this.pending = null;
    this.confirmLayer.active = false;
    this.root.active = false;
    this.onOpenTools?.();
  }

  private openGeneratorWorkshop(): void {
    this.pending = null;
    this.confirmLayer.active = false;
    this.root.active = false;
    this.onOpenGeneratorWorkshop?.();
  }

  private openJournal(): void {
    this.pending = null;
    this.confirmLayer.active = false;
    this.root.active = false;
    this.onOpenJournal?.();
  }

  private openCollection(chainId: string): void {
    this.pending = null;
    this.confirmLayer.active = false;
    this.root.active = false;
    this.onOpenCollection?.(chainId);
  }

  refresh(): void { if (this.root.active) this.render(); }
  get isOpen(): boolean { return this.root.active; }
}
